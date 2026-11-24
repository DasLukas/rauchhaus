/** Coordinates in an upright equilateral triangle of side length one, with y increasing down. */
export interface TrianglePoint {
  readonly x: number
  readonly y: number
}

export type TriangleFactor = 'heat' | 'oxygen' | 'fuel'
export const TRIANGLE_HEIGHT = Math.sqrt(3) / 2
export const TRIANGLE_CENTER: TrianglePoint = { x: 0.5, y: (2 * TRIANGLE_HEIGHT) / 3 }
/** The annotated starting view shows the door, top and right exterior of the stove. */
export const STOVE_START_ANGLE = (16 * Math.PI) / 180

// A factor is least available at the vertex opposite its labelled side.
const opposite: Record<TriangleFactor, TrianglePoint> = {
  heat: { x: 1, y: TRIANGLE_HEIGHT },
  oxygen: { x: 0, y: TRIANGLE_HEIGHT },
  fuel: { x: 0.5, y: 0 },
}
const factors = ['heat', 'oxygen', 'fuel'] as const

/** Qualitative observations for a specimen of wood under the selected conditions. */
export interface TriangleReading {
  readonly point: TrianglePoint
  readonly availability: Readonly<Record<TriangleFactor, number>>
  readonly limitingFactor: TriangleFactor | null
  readonly state: 'steady' | 'weak' | 'out'
  /** Visible flame height relative to the burning log at the centre. */
  readonly flame: number
  /** Visible glow of the remaining wood under the selected conditions. */
  readonly emberGlow: number
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

/** Return a point on the path from the centre (0) to the vertex opposite a factor (1). */
export function factorPoint(factor: TriangleFactor, deficiency: number): TrianglePoint {
  const amount = clamp(deficiency)
  const vertex = opposite[factor]
  return {
    x: TRIANGLE_CENTER.x + (vertex.x - TRIANGLE_CENTER.x) * amount,
    y: TRIANGLE_CENTER.y + (vertex.y - TRIANGLE_CENTER.y) * amount,
  }
}

/** Closest point on a side segment, including both endpoints. */
export function closestOnSide(point: TrianglePoint, factor: TriangleFactor): TrianglePoint {
  const start = factor === 'fuel' ? opposite.oxygen : opposite.fuel
  const end = factor === 'heat' ? opposite.oxygen : opposite.heat
  const dx = end.x - start.x
  const dy = end.y - start.y
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy))
  return { x: start.x + dx * t, y: start.y + dy * t }
}

// Barycentric coordinates here are perpendicular distances from the named sides / altitude.
function sideDistances(point: TrianglePoint): Record<TriangleFactor, number> {
  const fuel = 1 - point.y / TRIANGLE_HEIGHT
  const heat = point.x - fuel / 2
  return { heat, oxygen: 1 - heat - fuel, fuel }
}

/** Keep a drag inside the triangle. Outside positions slide along the nearest boundary. */
export function constrainPoint(point: TrianglePoint): TrianglePoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return TRIANGLE_CENTER
  const distances = sideDistances(point)
  if (factors.every((factor) => distances[factor] >= -1e-12)) return point
  let closest = TRIANGLE_CENTER
  let distance = Infinity
  for (const factor of factors) {
    const edge = closestOnSide(point, factor)
    const squared = (point.x - edge.x) ** 2 + (point.y - edge.y) ** 2
    if (squared < distance) {
      distance = squared
      closest = edge
    }
  }
  return closest
}

/**
 * Compare the same already-burning wood under a new set of conditions. The three sides
 * measure qualitative sufficiency, not physical concentrations. Once a factor is sufficient,
 * an excess cannot compensate for a different limiting factor.
 */
export function readTriangle(input: TrianglePoint): TriangleReading {
  const point = constrainPoint(input)
  const distances = sideDistances(point)
  const available = (factor: TriangleFactor) => clamp((1 - distances[factor]) * 1.5)
  const availability = {
    heat: available('heat'),
    oxygen: available('oxygen'),
    fuel: available('fuel'),
  }
  const least = factors.reduce((lowest, factor) =>
    availability[factor] < availability[lowest] ? factor : lowest,
  )
  const minimum = availability[least]
  // The caption starts calling the flames smaller once their height has dropped by a third.
  // Interpolate on both sides of that point so a small drag never jumps between two sizes.
  const extinction = 0.16
  const weakThreshold = 0.86
  const weakHeight = 0.66
  const sustained = clamp((minimum - extinction) / (weakThreshold - extinction))
  const nearCentre = clamp((minimum - weakThreshold) / (0.98 - weakThreshold))
  const flame = weakHeight * sustained + (1 - weakHeight) * nearCentre
  // Hot char can continue glowing after visible flames have gone out. These are
  // display settings for the comparison, not ignition or extinction measurements.
  const emberGlow = Math.sqrt(clamp((minimum - 0.05) / 0.95))
  return {
    point,
    availability,
    limitingFactor: sustained === 1 ? null : least,
    state: sustained === 1 ? 'steady' : sustained === 0 ? 'out' : 'weak',
    flame,
    emberGlow,
  }
}
