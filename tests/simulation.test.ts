import { describe, expect, it } from 'vitest'
import {
  DETECTORS,
  DOORS,
  ROOMS,
  SOURCES,
  SmokeSimulation,
  layerBase,
  volumeAbove,
  type SimulationSnapshot,
  type SourceId,
} from '../src/simulation'

function livingTrial(open: boolean): SmokeSimulation {
  const sim = new SmokeSimulation()
  sim.setDoor('d1', open)
  sim.start('s_tv')
  return sim
}

function mass(snapshot: SimulationSnapshot): number {
  return Object.values(snapshot.rooms).reduce((total, zone) => total + zone.smokeMass, 0)
}

function outsideLiving(snapshot: SimulationSnapshot): number {
  return mass(snapshot) - snapshot.rooms.living.smokeMass
}

describe('compartment transport', () => {
  it('starts with clear rooms, open interior doors and shut apartment doors', () => {
    const sim = new SmokeSimulation()
    sim.advance(10)
    const initial = sim.snapshot()
    expect(initial.elapsed).toBe(0)
    expect(initial.source).toBeNull()
    expect(mass(initial)).toBe(0)
    expect(initial.doors).toEqual({
      d0: false,
      d1: false,
      d2: false,
      d3: false,
      i0: true,
      i2: true,
    })
    for (const room of ROOMS) expect(initial.rooms[room.id].layerBaseY).toBe(room.ceilingY)
  })

  it('builds a descending upper layer before smoke reaches the open lintel', () => {
    const sim = livingTrial(true)
    sim.advance(2)
    const early = sim.snapshot()
    expect(early.rooms.living.smokeMass).toBeGreaterThan(0)
    expect(early.rooms.living.layerBaseY).toBeGreaterThan(3.74)
    expect(outsideLiving(early)).toBe(0)
    sim.advance(6)
    const later = sim.snapshot()
    expect(later.rooms.living.layerBaseY).toBeLessThan(early.rooms.living.layerBaseY)
    expect(later.rooms.stair1.smokeMass).toBeGreaterThan(0)
    expect(later.doorFlow.d1).toBeGreaterThan(0)
    expect(later.rooms.stair0.smokeMass).toBe(0)
  })

  it('reproduces the open/closed contrast across landings at the lesson observation point', () => {
    const open = livingTrial(true)
    const closed = livingTrial(false)
    open.advance(26)
    closed.advance(26)
    const a = open.snapshot()
    const b = closed.snapshot()
    expect(mass(a)).toBeCloseTo(mass(b), 9)
    expect(b.rooms.stair1.smokeMass).toBeGreaterThan(0) // Doors permit small leakage.
    for (const id of ['stair1', 'stair2', 'stair3'] as const) {
      expect(a.rooms[id].smokeMass).toBeGreaterThan(10 * b.rooms[id].smokeMass)
    }
    expect(a.rooms.stair1.opacity).toBeGreaterThan(b.rooms.stair1.opacity + 0.25)
    expect(a.rooms.stair1.layerBaseY).toBeLessThan(b.rooms.stair1.layerBaseY)
    expect(a.rooms.bedroom.smokeMass).toBe(0)
  })

  it('preserves smoke crossing a door, then restricts subsequent entry after closure', () => {
    const changed = livingTrial(true)
    const control = livingTrial(true)
    changed.advance(16)
    control.advance(16)
    const before = changed.snapshot()
    changed.setDoor('d1', false)
    expect(changed.snapshot().rooms).toEqual(before.rooms)
    expect(changed.snapshot().doorFlow.d1).toBe(0)
    expect(before.doors.d1).toBe(true) // Older snapshots stay valid.
    changed.advance(6)
    control.advance(6)
    expect(outsideLiving(changed.snapshot())).toBeGreaterThanOrEqual(outsideLiving(before))
    expect(outsideLiving(changed.snapshot())).toBeLessThan(outsideLiving(control.snapshot()))
    expect(changed.snapshot().rooms.stair1.opacity).toBeGreaterThan(0)
    changed.setDoor('d1', true)
    changed.advance(1)
    expect(changed.snapshot().doorFlow.d1).toBeGreaterThan(0)
  })

  it('separates the kitchen and dining room at the actual internal door', () => {
    const compare = (open: boolean) => {
      const sim = new SmokeSimulation()
      sim.setDoor('i0', open)
      sim.setDoor('d0', true)
      sim.start('s_stove')
      sim.advance(20)
      return sim.snapshot()
    }
    const a = compare(true)
    const b = compare(false)
    expect(a.rooms.dining.smokeMass).toBeGreaterThan(10 * b.rooms.dining.smokeMass)
    expect(a.rooms.stair0.smokeMass).toBeGreaterThan(b.rooms.stair0.smokeMass)
    expect(a.rooms.living.smokeMass).toBeLessThan(a.rooms.stair1.smokeMass)
  })

  it('detects smoke only when the local layer reaches the actual sensing height', () => {
    const sim = new SmokeSimulation()
    sim.start('s_attic')
    sim.advance(1 / 30)
    expect(Object.values(sim.snapshot().detectors)).not.toContain(true)
    sim.advance(3)
    const snapshot = sim.snapshot()
    expect(snapshot.detectors).toEqual({ m_living: false, m_bed: false, m_attic: true })
    const detector = DETECTORS.find((item) => item.id === 'm_attic')
    if (!detector) throw new Error('Missing detector in the attic')
    expect(snapshot.rooms.attic.layerBaseY).toBeLessThanOrEqual(detector.sensorY)
    expect(snapshot.rooms.playroom.smokeMass).toBe(0)
  })

  it('fits the upper layer to the pitched roof, including its narrower stair landing', () => {
    for (const room of ROOMS.filter((room) => room.floor === 3)) {
      const capacity = volumeAbove(room, room.floorY)
      const boxVolume =
        (room.maxX - room.minX) * (room.maxZ - room.minZ) * (room.ceilingY - room.floorY)
      expect(capacity).toBeLessThan(boxVolume)
      for (const fraction of [0.01, 0.25, 0.75, 0.99]) {
        expect(volumeAbove(room, layerBase(room, capacity * fraction))).toBeCloseTo(
          capacity * fraction,
          3,
        )
      }
      expect(layerBase(room, 0)).toBe(room.ceilingY)
      expect(layerBase(room, capacity)).toBe(room.floorY)
    }
  })
})

describe('interactive simulation clock', () => {
  it('produces the same result across frame rates and time spent paused', () => {
    const normal = livingTrial(true)
    const variable = livingTrial(true)
    normal.advance(20)
    for (let i = 0; i < 300; i++) {
      variable.advance(1 / 60)
      variable.advance(1 / 20)
    }
    const before = variable.snapshot()
    variable.advance(Number.NaN)
    variable.advance(-1)
    variable.advance(0)
    expect(variable.snapshot()).toBe(before)
    expect(variable.snapshot()).toEqual(normal.snapshot())
  })

  it('restarts or switches sources with clean rooms and the chosen door setup', () => {
    const sim = livingTrial(true)
    sim.advance(20)
    const original = sim.snapshot()
    sim.start('s_tv')
    sim.advance(20)
    expect(sim.snapshot()).toEqual(original)
    sim.start('s_candle')
    const fresh = sim.snapshot()
    expect(fresh.source).toBe('s_candle')
    expect(fresh.elapsed).toBe(0)
    expect(fresh.doors.d1).toBe(true)
    expect(mass(fresh)).toBe(0)
    expect(Object.values(fresh.detectors)).not.toContain(true)
    sim.reset()
    sim.advance(1)
    expect(sim.snapshot().source).toBeNull()
    expect(sim.snapshot().elapsed).toBe(0)
  })

  it.each(SOURCES.map((source) => [source.id] as [SourceId]))(
    'preserves tracer after burnout and bounds every layer for source %s',
    (id) => {
      const sim = new SmokeSimulation()
      sim.start(id)
      for (const door of DOORS) sim.setDoor(door.id, true)
      sim.advance(58)
      const exhausted = sim.snapshot()
      expect(exhausted.sourceStrength).toBe(0)
      expect(mass(exhausted)).toBeGreaterThan(0)
      sim.advance(45)
      const later = sim.snapshot()
      expect(mass(later)).toBeCloseTo(mass(exhausted), 8)
      for (const room of ROOMS) {
        const zone = later.rooms[room.id]
        expect(zone.layerBaseY).toBeGreaterThanOrEqual(room.floorY)
        expect(zone.layerBaseY).toBeLessThanOrEqual(room.ceilingY)
        expect(zone.opacity).toBeGreaterThanOrEqual(0)
        expect(zone.opacity).toBeLessThanOrEqual(1)
      }
    },
  )
})
