import { CompartmentFire, type FireState } from './fire'
import {
  type DetectorId,
  type DoorId,
  floorArea,
  HOUSE,
  layerBase,
  type Room,
  type RoomId,
  roofHeightAt,
  type SourceId,
  volumeAbove,
} from './house'

export type { FireState } from './fire'
export * from './house'

/** Plume rise in model-space units per demonstration second. */
export const PLUME_RISE_SPEED = 1.35

interface CeilingFront {
  readonly x: number
  readonly z: number
  radius: number
  /** Vertical distance still to rise before the horizontal current starts. */
  riseRemaining: number
}

export interface SmokeLayer {
  /** Absolute model-space Y of the interface between the upper and lower zones. */
  readonly layerBaseY: number
  /** Reference opacity across the room's full Z depth, in [0, 1]. */
  readonly opacity: number
  /** Relative concentration in [0, 1], independent of a thin layer's visibility. */
  readonly density: number
  /** Conserved tracer in illustrative units, exposed for regression checks. */
  readonly smokeMass: number
  /** Ceiling-current footprint and approach, absent in a clear compartment. */
  readonly ceilingFront: Readonly<CeilingFront> | null
}

export interface SimulationSnapshot {
  /** Time on the demonstration clock, unrelated to real evacuation times. */
  readonly elapsed: number
  readonly source: SourceId | null
  /** Visible flames in the source room, absent while the house is idle. */
  readonly fire: FireState | null
  /** Visible plume strength at the object, before its smoke reaches the ceiling. */
  readonly sourceStrength: number
  /** Net tracer created in the upper layer since the experiment started. */
  readonly producedMass: number
  /** Smoke tracer that has crossed the exterior doorway into the open air. */
  readonly escapedMass: number
  readonly rooms: Readonly<Record<RoomId, SmokeLayer>>
  readonly doors: Readonly<Record<DoorId, boolean>>
  readonly detectors: Readonly<Record<DetectorId, boolean>>
  /** Normalized signed flow, positive in the order defined in DOORS. */
  readonly doorFlow: Readonly<Record<DoorId, number>>
  /** Active seconds of uninterrupted open-door flow in its current direction, capped at 30. */
  readonly doorFlowAge: Readonly<Record<DoorId, number>>
  /** Signed upward flow leaving each landing for the storey above; zero in rooms. */
  readonly stairFlow: Readonly<Record<RoomId, number>>
  /** Seconds of continuous downward transfer into each lower landing, capped at 30. */
  readonly stairDownAge: Readonly<Record<RoomId, number>>
}

function table<K extends string, T extends { readonly id: K }, V>(
  definitions: readonly T[],
  make: (definition: T) => V,
): Record<T['id'], V> {
  return Object.fromEntries(definitions.map((item) => [item.id, make(item)])) as Record<T['id'], V>
}

interface Cell {
  readonly bounds: Room
  readonly capacity: number
  readonly area: number
  readonly span: number
  volume: number
  mass: number
  heat: number
  base: number
  inflow: number
  outflow: number
  volumeChange: number
  massChange: number
  heatChange: number
  front: CeilingFront | null
}

type Opening = {
  readonly first: Cell
  readonly topY: number
  readonly x: number
  readonly z: number
  readonly width: number
  /** Maximum volume of clear air entrained per unit of transported layer gas. */
  readonly entrainment: number
  expansion: number
  transfer: number
  exchange: number
} & (
  | { readonly door: DoorId; readonly second: Cell | null }
  | { readonly door: null; readonly second: Cell }
)

const TICK = 1 / 30
const COOLING = Math.exp(-0.012 * TICK)
const LEAKAGE = 0.009
// Mixing across a stair opening develops as the layer approaches from above.
const STAIR_MIX_DEPTH = 0.6
// Once clear headroom is this shallow, turbulent exchange increasingly
// recirculates smoky gas instead of entraining fresh air.
const RESIDUAL_AIR_DEPTH = 0.3
// A developed current has crossed even the widest compartment by this age.
const MAX_FLOW_AGE = 30

function cell(bounds: Room): Cell {
  return {
    bounds,
    capacity: volumeAbove(bounds, bounds.floorY),
    area: floorArea(bounds),
    span: Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) + 0.5,
    volume: 0,
    mass: 0,
    heat: 0,
    base: bounds.ceilingY,
    inflow: 0,
    outflow: 0,
    volumeChange: 0,
    massChange: 0,
    heatChange: 0,
    front: null,
  }
}

// A small, steady fire gives the free exploration and both door trials the same source.
const LOCAL_FIRE: FireState = Object.freeze({
  phase: 'local',
  burstSeed: 0,
  sourceIntensity: 0.3,
  outgassing: 0,
  rollover: 0,
  involvement: 0,
})

function emission(time: number): number {
  return Math.max(0, Math.min(1, time / 4))
}

/** Feed the upper layer from the plume and return its newly formed tracer. */
function feedSource(zone: Cell, age: number, fire: CompartmentFire | null): number {
  const growth = Math.max(0, Math.min(1, (age - 7) / 9))
  // The local fire follows a repeatable smoke curve for the door comparison.
  // In the compartment-fire lesson, its development drives smoke production.
  const release = fire ? fire.plumeStrength : 1 + growth
  const gas = 0.85 * TICK * emission(age) * release
  if (gas <= 0) return 0
  const soot = fire?.sootYield ?? 0.16 + 0.7 * Math.max(0, Math.min(1, age / 20))
  const added = Math.min(gas, zone.capacity - zone.volume)
  const nextVolume = zone.volume + added
  // Once all clear air is in the upper layer, the plume recirculates gas.
  // Recirculation enriches the layer up to the source mixture's concentration.
  // A better ventilated flame cannot remove existing tracer.
  const mixed = -Math.expm1(-(gas - added) / nextVolume)
  const addedMass = soot * added + mixed * Math.max(0, soot * zone.volume - zone.mass)
  zone.mass += addedMass
  zone.heat += 0.94 * added + mixed * (0.94 * zone.volume - zone.heat)
  zone.volume = nextVolume
  zone.base = layerBase(zone.bounds, zone.volume)
  return addedMass
}

function warmth(zone: Cell): number {
  return zone.volume > 0 ? Math.min(1, zone.heat / zone.volume) : 0
}

function ceilingY(room: Room, x: number): number {
  return room.roof ? roofHeightAt(x, room.roof) : room.ceilingY
}

// Intersect the ceiling footprint with the actual door span. Point locations
// (stair eye and detector) use a soft leading edge.
function coverage(zone: Cell, x: number, z: number, width: number): number {
  const front = zone.front
  if (!front || front.riseRemaining > 0) return 0
  const dx = Math.abs(x - front.x)
  if (dx >= front.radius) return 0
  if (width === 0) {
    const reach = front.radius - Math.hypot(dx, z - front.z)
    return Math.max(0, Math.min(1, reach / 0.35))
  }
  const reachZ = Math.sqrt(front.radius ** 2 - dx ** 2)
  const near = Math.max(z - width / 2, front.z - reachZ)
  const far = Math.min(z + width / 2, front.z + reachZ)
  return Math.max(0, far - near) / width
}

function doorwayHead(zone: Cell, lintelY: number): number {
  // Only the part of the upper layer that intersects the opening drives transfer.
  const depth = Math.max(0, lintelY - zone.base)
  return depth * Math.sqrt(depth * warmth(zone))
}

function clearAirFraction(zone: Cell, mixingDepth: number): number {
  return Math.min(1, (zone.base - zone.bounds.floorY) / mixingDepth)
}

function stairFlow(lower: Cell, upper: Cell, x: number, z: number): number {
  // As the upper interface approaches the open stair, the rising plume has
  // progressively less clear air to rise through. A backed-up layer can mix
  // down through the same opening, especially once its gases have cooled.
  const upperClearance = clearAirFraction(upper, STAIR_MIX_DEPTH)
  const lowerClearance = clearAirFraction(lower, STAIR_MIX_DEPTH)
  const up =
    Math.min(1, lower.volume / lower.area) *
    Math.sqrt(warmth(lower)) *
    upperClearance *
    coverage(lower, x, z, 0)
  const spill = 1 - upperClearance
  const down =
    spill * Math.sqrt(spill) * (1 - 0.6 * warmth(upper)) * lowerClearance * coverage(upper, x, z, 0)
  return up - down
}

/** Requested equal-volume exchange between two smoke layers in contact at an opening. */
function layerExchange(opening: Opening, netRate: number): number {
  const { first, second, door, x, z, width, topY } = opening
  if (!second || first.volume <= 0 || second.volume <= 0) return 0
  let contact: number
  if (door === null) {
    // The layers meet at the eye as smoke fills the landing above.
    contact =
      (1 - clearAirFraction(second, STAIR_MIX_DEPTH)) * Math.min(1, first.volume / first.area)
  } else {
    // The return stream also carries smoke when clear air is scarce on both sides.
    const returnSmoke =
      1 -
      Math.max(
        clearAirFraction(first, RESIDUAL_AIR_DEPTH),
        clearAirFraction(second, RESIDUAL_AIR_DEPTH),
      )
    contact = width * Math.max(0, topY - Math.max(first.base, second.base)) * returnSmoke
  }
  if (contact <= 0) return 0
  const sharedFront = Math.min(coverage(first, x, z, width), coverage(second, x, z, width))
  // A strong directional current leaves less of the opening for two-way mixing.
  const exchangeRate = 0.65 / (1 + 4 * Math.abs(netRate))
  return TICK * exchangeRate * contact * sharedFront
}

/** Swap accepted parcels without changing layer heights or reporting a one-way current. */
function exchangeLayerGas(first: Cell, second: Cell, requested: number): void {
  const volume =
    requested * Math.min(1, first.volume / first.outflow, second.volume / second.outflow)
  const mass = volume * (first.mass / first.volume - second.mass / second.volume)
  const heat = volume * (first.heat / first.volume - second.heat / second.volume)
  first.massChange -= mass
  second.massChange += mass
  first.heatChange -= heat
  second.heatChange += heat
}

/**
 * Interactive two-zone teaching model for this house. A buoyant plume feeds an
 * upper layer. Door openings exchange upper-layer gas above the neutral region
 * with compensating clear air below, and stair openings connect adjacent landings.
 * Air entrainment and cooling are qualitative. The constants are lesson pacing,
 * not calibrated predictions of real conditions, toxicity or safe passage.
 */
export class SmokeSimulation {
  private readonly house: typeof HOUSE
  private readonly cells: Record<RoomId, Cell>
  private readonly doors: Record<DoorId, boolean>
  private readonly flows: Record<DoorId, number>
  private readonly flowAges: Record<DoorId, number>
  private readonly stairFlows: Record<RoomId, number>
  private readonly stairDownAges: Record<RoomId, number>
  private producedMass = 0
  private escapedMass = 0
  private readonly openings: Opening[]
  private source: SourceId | null = null
  private sourceCell: Cell | null = null
  private sourceDoors: Opening[] = []
  private fire: CompartmentFire | null = null
  private plumeRiseTime = 0
  private ticks = 0
  private remainder = 0
  private cached: SimulationSnapshot | null = null

  constructor(
    house = HOUSE,
    private readonly fireScenario: 'local' | 'compartment' = 'local',
    private readonly burstSeed = 0,
  ) {
    this.house = house
    this.cells = table(house.rooms, cell)
    this.doors = table(house.doors, (door) => door.initiallyOpen)
    this.flows = table(house.doors, () => 0)
    this.flowAges = table(house.doors, () => 0)
    this.stairFlows = table(house.rooms, () => 0)
    this.stairDownAges = table(house.rooms, () => 0)
    this.openings = house.doors.map((door) => ({
      first: this.cells[door.rooms[0]],
      second: door.rooms[1] === 'outside' ? null : this.cells[door.rooms[1]],
      door: door.id,
      topY: door.topY,
      x: door.x,
      z: (door.hingeZ + door.latchZ) / 2,
      width: Math.abs(door.hingeZ - door.latchZ),
      entrainment: 0.12,
      expansion: 1,
      transfer: 0,
      exchange: 0,
    }))
    for (let i = 1; i < house.floors.length; i++) {
      const lower = house.floors[i - 1].landing
      const upper = house.floors[i].landing
      this.openings.push({
        first: this.cells[lower],
        second: this.cells[upper],
        door: null,
        topY: this.cells[upper].bounds.floorY,
        x: house.dimensions.stairEyeX,
        z: house.dimensions.stairEyeZ,
        width: 0,
        entrainment: 0.25,
        expansion: 1,
        transfer: 0,
        exchange: 0,
      })
    }
  }

  /** Playback time, including the fraction of a tick already shown to the viewer. */
  get playbackTime(): number {
    return this.ticks * TICK + this.remainder
  }

  /** Empties the building, retaining every selected door position. */
  reset(): void {
    for (const bounds of this.house.rooms) {
      Object.assign(this.cells[bounds.id], cell(bounds))
      this.stairFlows[bounds.id] = 0
      this.stairDownAges[bounds.id] = 0
    }
    for (const door of this.house.doors) {
      this.flows[door.id] = 0
      this.flowAges[door.id] = 0
    }
    this.producedMass = 0
    this.escapedMass = 0
    this.source = null
    this.sourceCell = null
    this.sourceDoors = []
    this.fire = null
    this.plumeRiseTime = 0
    this.ticks = 0
    this.remainder = 0
    this.cached = null
  }

  /** Starts a fresh experiment with one source and the current door positions. */
  start(id: SourceId): void {
    const source = this.house.sources.find((item) => item.id === id)
    if (!source) throw new RangeError('Unknown smoke source')
    this.reset()
    this.source = id
    this.sourceCell = this.cells[source.room]
    this.sourceDoors = this.openings.filter(
      (opening) =>
        opening.door && (opening.first === this.sourceCell || opening.second === this.sourceCell),
    )
    this.fire = this.fireScenario === 'compartment' ? new CompartmentFire(this.burstSeed) : null
    const [x, y, z] = source.position
    this.plumeRiseTime = (ceilingY(this.sourceCell.bounds, x) - y) / PLUME_RISE_SPEED
    this.sourceCell.front = { x, z, radius: 0, riseRemaining: 0 }
  }

  /** Applies a new door position immediately, preserving all smoke already present. */
  setDoor(id: DoorId, open: boolean): void {
    if (!Object.hasOwn(this.doors, id)) throw new RangeError('Unknown door')
    if (this.doors[id] === open) return
    this.doors[id] = open
    this.flows[id] = 0
    this.flowAges[id] = 0
    this.cached = null
  }

  /**
   * Advances by seconds of active viewing. Paused or hidden viewers should omit
   * calls. Invalid or nonpositive deltas are ignored. A single call is bounded
   * to one demonstration minute to avoid replaying a dormant tab's entire day.
   * Ordinary refresh-rate variation is accumulated into fixed transport ticks.
   */
  advance(seconds: number): void {
    if (!this.sourceCell || !Number.isFinite(seconds) || seconds <= 0) return
    this.remainder += Math.min(seconds, 60)
    const steps = Math.floor((this.remainder + 1e-10) / TICK)
    if (steps === 0) return
    this.remainder = Math.max(0, this.remainder - steps * TICK)
    for (let i = 0; i < steps; i++) this.step(this.sourceCell)
    this.cached = null
  }

  private recordFlow(opening: Opening, flow: number): void {
    const id = opening.door
    if (id === null) {
      const landing = opening.first.bounds.id
      this.stairFlows[landing] = flow
      this.stairDownAges[landing] =
        flow < 0 ? Math.min(MAX_FLOW_AGE, this.stairDownAges[landing] + TICK) : 0
      return
    }
    const sameDirection = Math.sign(flow) === Math.sign(this.flows[id])
    this.flowAges[id] =
      this.doors[id] && flow !== 0
        ? Math.min(MAX_FLOW_AGE, (sameDirection ? this.flowAges[id] : 0) + TICK)
        : 0
    this.flows[id] = flow
  }

  private step(source: Cell): void {
    this.ticks++
    const sourceAge = this.ticks * TICK - this.plumeRiseTime
    if (this.fire) {
      let ventilation = 0
      for (const opening of this.sourceDoors) {
        if (!opening.door || !this.doors[opening.door]) continue
        const neighbour = opening.first === source ? opening.second : opening.first
        const freshAir = neighbour ? clearAirFraction(neighbour, 0.6) : 1
        ventilation += opening.width * freshAir
      }
      this.fire.advance(TICK, Math.min(1, ventilation), source.volume / source.area, warmth(source))
    }
    this.producedMass += feedSource(source, sourceAge, this.fire)

    for (const room of this.house.rooms) {
      const zone = this.cells[room.id]
      zone.inflow = zone.outflow = zone.volumeChange = zone.massChange = zone.heatChange = 0
    }
    for (const opening of this.openings) {
      const { first, second, door, topY, x, z, width } = opening
      let rate: number
      if (door === null) {
        rate = stairFlow(first, second, x, z)
      } else {
        const permeability = this.doors[door] ? 1 : LEAKAGE
        // Fresh exterior air carries no upper-layer smoke into the model.
        const head = doorwayHead(first, topY) * coverage(first, x, z, width)
        const backPressure = second ? doorwayHead(second, topY) * coverage(second, x, z, width) : 0
        rate = 0.9 * width * permeability * (head - backPressure)
      }
      opening.transfer = rate * TICK
      const donor = rate < 0 && second ? second : first
      const receiver = rate < 0 ? first : second
      donor.outflow += Math.abs(opening.transfer)
      if (receiver) {
        opening.expansion = 1 + opening.entrainment * clearAirFraction(receiver, RESIDUAL_AIR_DEPTH)
        receiver.inflow += Math.abs(opening.transfer) * opening.expansion
      }
      opening.exchange = door === null || this.doors[door] ? layerExchange(opening, rate) : 0
      if (second && opening.exchange > 0) {
        first.outflow += opening.exchange
        second.outflow += opening.exchange
      }
    }
    for (const opening of this.openings) {
      if (opening.second && opening.exchange > 0) {
        exchangeLayerGas(opening.first, opening.second, opening.exchange)
      }
      const forward = opening.transfer >= 0
      const donor = !forward && opening.second ? opening.second : opening.first
      const receiver = forward ? opening.second : opening.first
      if (
        opening.transfer === 0 ||
        donor.volume <= 0 ||
        (receiver && receiver.volume >= receiver.capacity)
      ) {
        this.recordFlow(opening, 0)
        continue
      }
      // All competing openings share the donor's gas and receiving free
      // volume. No room spends an outflow that another opening might reject.
      const receiverShare = receiver ? (receiver.capacity - receiver.volume) / receiver.inflow : 1
      const volume =
        Math.abs(opening.transfer) * Math.min(1, donor.volume / donor.outflow, receiverShare)
      const fraction = volume / donor.volume
      const tracer = fraction * donor.mass
      const heat = fraction * donor.heat
      donor.volumeChange -= volume
      donor.massChange -= tracer
      donor.heatChange -= heat
      if (receiver) {
        receiver.volumeChange += volume * opening.expansion
        receiver.massChange += tracer
        receiver.heatChange += heat
        if (!receiver.front && volume > 0) {
          const { x, z, topY } = opening
          const rise = Math.max(0, ceilingY(receiver.bounds, x) - topY)
          receiver.front = { x, z, radius: 0, riseRemaining: rise }
        }
      } else {
        this.escapedMass += tracer
      }
      const signedFlow = (forward ? 1 : -1) * Math.min(1, volume / TICK)
      this.recordFlow(opening, signedFlow)
    }
    for (const room of this.house.rooms) {
      const zone = this.cells[room.id]
      zone.volume = Math.max(0, Math.min(zone.capacity, zone.volume + zone.volumeChange))
      zone.mass = Math.max(0, zone.mass + zone.massChange)
      zone.heat = Math.max(0, zone.heat + zone.heatChange) * COOLING
      zone.base = layerBase(room, zone.volume)
      const front = zone.front
      if (front && zone.volume > 0) {
        // Only the part of the tick left after the vertical rise advances the
        // ceiling current. Its origin survives door closure.
        const rise = Math.min(front.riseRemaining, TICK * PLUME_RISE_SPEED)
        front.riseRemaining -= rise
        const travelTime = TICK - rise / PLUME_RISE_SPEED
        // A trickle through a shut door cannot sweep a whole ceiling at the
        // speed of an open doorway jet. Swept area grows with available gas.
        const depth = zone.volume / zone.area
        const suppliedRadius = zone.span * Math.min(1, Math.sqrt(depth / 0.09))
        const advance = Math.min(
          travelTime * 1.05 * Math.sqrt(warmth(zone)),
          suppliedRadius - front.radius,
        )
        front.radius += Math.max(0, advance)
      }
    }
  }

  /** Returns a read-only snapshot valid even after the next tick or restart. */
  snapshot(): SimulationSnapshot {
    if (this.cached) return this.cached
    const rooms = table(this.house.rooms, (room) => {
      const zone = this.cells[room.id]
      const density = zone.volume > 0 ? Math.min(1, zone.mass / zone.volume) : 0
      // Mean depth avoids giving a trace at a narrow gable ridge the opacity
      // of a deep layer across the storey.
      const depth = zone.volume / zone.area
      const opacity =
        -Math.expm1(-1.5 * density * (room.maxZ - room.minZ)) * -Math.expm1(-depth / 0.15)
      const ceilingFront = zone.front && zone.volume > 0 ? Object.freeze({ ...zone.front }) : null
      return Object.freeze({
        layerBaseY: zone.base,
        opacity,
        density,
        smokeMass: zone.mass,
        ceilingFront,
      })
    })
    const detectors = table(this.house.detectors, (detector) => {
      const zone = rooms[detector.room]
      const [x, , z] = detector.position
      return (
        zone.density >= 0.035 &&
        zone.layerBaseY <= detector.sensorY &&
        coverage(this.cells[detector.room], x, z, 0) > 0
      )
    })
    const elapsed = this.ticks * TICK
    this.cached = Object.freeze({
      elapsed,
      source: this.source,
      fire: this.source ? this.fire?.snapshot() ?? LOCAL_FIRE : null,
      producedMass: this.producedMass,
      escapedMass: this.escapedMass,
      sourceStrength: this.source ? Math.min(1, this.fire?.plumeStrength ?? 1) : 0,
      rooms: Object.freeze(rooms),
      detectors: Object.freeze(detectors),
      doors: Object.freeze({ ...this.doors }),
      doorFlow: Object.freeze({ ...this.flows }),
      doorFlowAge: Object.freeze({ ...this.flowAges }),
      stairFlow: Object.freeze({ ...this.stairFlows }),
      stairDownAge: Object.freeze({ ...this.stairDownAges }),
    })
    return this.cached
  }
}
