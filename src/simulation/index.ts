import {
  HOUSE,
  floorArea,
  layerBase,
  volumeAbove,
  type DetectorId,
  type DoorId,
  type Room,
  type RoomId,
  type SourceId,
} from './house'

export * from './house'

export interface SmokeLayer {
  /** Absolute model-space Y of the interface between the upper and lower zones. */
  readonly layerBaseY: number
  /** Visual intensity in [0, 1]; the renderer still clips to the room geometry. */
  readonly opacity: number
  /** Relative concentration in [0, 1], independent of a thin layer's visibility. */
  readonly density: number
  /** Conserved tracer in illustrative units, exposed for regression checks. */
  readonly smokeMass: number
}

export interface SimulationSnapshot {
  /** Time on the demonstration clock, unrelated to real evacuation times. */
  readonly elapsed: number
  readonly source: SourceId | null
  /** Normalized emission strength; previously emitted smoke survives source burnout. */
  readonly sourceStrength: number
  /** Smoke tracer that has crossed the exterior doorway into the open air. */
  readonly escapedMass: number
  readonly rooms: Readonly<Record<RoomId, SmokeLayer>>
  readonly doors: Readonly<Record<DoorId, boolean>>
  readonly detectors: Readonly<Record<DetectorId, boolean>>
  /** Normalized signed flow, positive in the order defined in DOORS. */
  readonly doorFlow: Readonly<Record<DoorId, number>>
  /** Signed upward flow leaving each landing for the storey above; zero in rooms. */
  readonly stairFlow: Readonly<Record<RoomId, number>>
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
  volume: number
  mass: number
  heat: number
  base: number
  outflow: number
  volumeChange: number
  massChange: number
  heatChange: number
}

type Opening = {
  readonly first: Cell
  readonly topY: number
  transfer: number
} & (
  | { readonly door: DoorId; readonly second: Cell | null }
  | { readonly door: null; readonly second: Cell }
)

const TICK = 1 / 30
const COOLING = Math.exp(-0.012 * TICK)
const LEAKAGE = 0.009

function cell(bounds: Room): Cell {
  return {
    bounds,
    capacity: volumeAbove(bounds, bounds.floorY),
    area: floorArea(bounds),
    volume: 0,
    mass: 0,
    heat: 0,
    base: bounds.ceilingY,
    outflow: 0,
    volumeChange: 0,
    massChange: 0,
    heatChange: 0,
  }
}

function emission(time: number): number {
  // One bounded, repeatable illustrative source profile for every comparison.
  return Math.max(0, Math.min(1, time / 0.8, (56 - time) / 12))
}

function warmth(zone: Cell): number {
  return zone.volume > 0 ? Math.min(1, zone.heat / zone.volume) : 0
}

function doorwayHead(zone: Cell, lintelY: number): number {
  // Only the part of the upper layer that intersects the opening drives transfer.
  const depth = Math.max(0, lintelY - zone.base)
  return depth * Math.sqrt(depth * warmth(zone))
}

function stairFlow(lower: Cell, upper: Cell): number {
  const up = Math.min(1, lower.volume / lower.area) * Math.sqrt(warmth(lower))
  // Dense smoke on a filled upper landing may spill back into the landing below.
  const spillDepth = Math.max(0, 0.25 - (upper.base - upper.bounds.floorY))
  const down = spillDepth * (1 - 0.6 * warmth(upper))
  return up - down
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
  private readonly stairFlows: Record<RoomId, number>
  private escapedMass = 0
  private readonly openings: Opening[]
  private source: SourceId | null = null
  private sourceCell: Cell | null = null
  private ticks = 0
  private remainder = 0
  private cached: SimulationSnapshot | null = null

  constructor(house = HOUSE) {
    this.house = house
    this.cells = table(house.rooms, cell)
    this.doors = table(house.doors, (door) => door.initiallyOpen)
    this.flows = table(house.doors, () => 0)
    this.stairFlows = table(house.rooms, () => 0)
    this.openings = house.doors.map((door) => ({
      first: this.cells[door.rooms[0]],
      second: door.rooms[1] === 'outside' ? null : this.cells[door.rooms[1]],
      door: door.id,
      topY: door.topY,
      transfer: 0,
    }))
    for (let i = 1; i < house.floors.length; i++) {
      const lower = house.floors[i - 1].landing
      const upper = house.floors[i].landing
      this.openings.push({
        first: this.cells[lower],
        second: this.cells[upper],
        door: null,
        topY: 0,
        transfer: 0,
      })
    }
  }

  /** Empties the building, retaining every selected door position. */
  reset(): void {
    for (const bounds of this.house.rooms) {
      Object.assign(this.cells[bounds.id], cell(bounds))
      this.stairFlows[bounds.id] = 0
    }
    for (const door of this.house.doors) this.flows[door.id] = 0
    this.escapedMass = 0
    this.source = null
    this.sourceCell = null
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
  }

  /** Applies a new door position immediately, preserving all smoke already present. */
  setDoor(id: DoorId, open: boolean): void {
    if (!Object.hasOwn(this.doors, id)) throw new RangeError('Unknown door')
    if (this.doors[id] === open) return
    this.doors[id] = open
    this.flows[id] = 0
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

  private step(source: Cell): void {
    this.ticks++
    const emitted = 0.93 * TICK * emission(this.ticks * TICK)
    source.volume = Math.min(source.capacity, source.volume + emitted)
    source.mass += 0.46 * emitted
    source.heat += 0.94 * emitted
    source.base = layerBase(source.bounds, source.volume)

    for (const room of this.house.rooms) {
      const zone = this.cells[room.id]
      zone.outflow = zone.volumeChange = zone.massChange = zone.heatChange = 0
    }
    for (const opening of this.openings) {
      const { first, second, door, topY } = opening
      let rate: number
      if (door === null) {
        rate = stairFlow(first, second)
      } else {
        const permeability = this.doors[door] ? 1 : LEAKAGE
        // Fresh exterior air carries no upper-layer smoke into the model.
        const backPressure = second ? doorwayHead(second, topY) : 0
        rate = 0.94 * permeability * (doorwayHead(first, topY) - backPressure)
      }
      opening.transfer = rate * TICK
      const donor = rate < 0 && second ? second : first
      donor.outflow += Math.abs(opening.transfer)
    }
    for (const opening of this.openings) {
      const forward = opening.transfer >= 0
      const donor = !forward && opening.second ? opening.second : opening.first
      const receiver = forward ? opening.second : opening.first
      if (donor.volume <= 0 || donor.outflow <= 0) {
        if (opening.door !== null) this.flows[opening.door] = 0
        else this.stairFlows[opening.first.bounds.id] = 0
        continue
      }
      // Competing openings share the available volume; all fluxes read the
      // same pre-transport state, independent of the order rooms are updated.
      const volume = Math.abs(opening.transfer) * Math.min(1, donor.volume / donor.outflow)
      const fraction = volume / donor.volume
      const tracer = fraction * donor.mass
      const heat = fraction * donor.heat
      donor.volumeChange -= volume
      donor.massChange -= tracer
      donor.heatChange -= heat
      if (receiver) {
        receiver.volumeChange += volume * (opening.door === null ? 1.25 : 1.12)
        receiver.massChange += tracer
        receiver.heatChange += heat
      } else {
        this.escapedMass += tracer
      }
      const signedFlow = (forward ? 1 : -1) * Math.min(1, volume / TICK)
      if (opening.door !== null) this.flows[opening.door] = signedFlow
      else this.stairFlows[opening.first.bounds.id] = signedFlow
    }
    for (const room of this.house.rooms) {
      const zone = this.cells[room.id]
      zone.volume = Math.max(0, Math.min(zone.capacity, zone.volume + zone.volumeChange))
      zone.mass = Math.max(0, zone.mass + zone.massChange)
      zone.heat = Math.max(0, zone.heat + zone.heatChange) * COOLING
      zone.base = layerBase(room, zone.volume)
    }
  }

  /** Returns a read-only snapshot valid even after the next tick or restart. */
  snapshot(): SimulationSnapshot {
    if (this.cached) return this.cached
    const rooms = table(this.house.rooms, (room) => {
      const zone = this.cells[room.id]
      const density = zone.volume > 0 ? Math.min(1, zone.mass / zone.volume) : 0
      const depth = room.ceilingY - zone.base
      const opacity = 0.85 * (1 - Math.exp(-2.25 * density)) * (1 - Math.exp(-depth / 0.15))
      return Object.freeze({ layerBaseY: zone.base, opacity, density, smokeMass: zone.mass })
    })
    const detectors = table(this.house.detectors, (detector) => {
      const zone = rooms[detector.room]
      return zone.density >= 0.035 && zone.layerBaseY <= detector.sensorY
    })
    const elapsed = this.ticks * TICK
    this.cached = Object.freeze({
      elapsed,
      source: this.source,
      escapedMass: this.escapedMass,
      sourceStrength: this.source ? emission(elapsed) : 0,
      rooms: Object.freeze(rooms),
      detectors: Object.freeze(detectors),
      doors: Object.freeze({ ...this.doors }),
      doorFlow: Object.freeze({ ...this.flows }),
      stairFlow: Object.freeze({ ...this.stairFlows }),
    })
    return this.cached
  }
}
