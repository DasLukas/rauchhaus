import { describe, expect, it } from 'vitest'
import {
  DETECTORS,
  DIMENSIONS,
  DOORS,
  FLOORS,
  getHouse,
  houseVariantForSearch,
  layerBase,
  PLUME_RISE_SPEED,
  ROOF,
  ROOMS,
  roofHeightAt,
  type SimulationSnapshot,
  SmokeSimulation,
  SOURCES,
  type SourceId,
  volumeAbove,
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

describe('selectable houses', () => {
  it('uses the small house by default and recognizes the explicit large-house route', () => {
    expect(houseVariantForSearch('')).toBe('klein')
    expect(houseVariantForSearch('?haus=klein')).toBe('klein')
    expect(houseVariantForSearch('?haus=other')).toBe('klein')
    expect(houseVariantForSearch('?klasse=2&haus=gross')).toBe('gross')
    expect(getHouse('klein').modelFilename).toBe('rauchhaus-klein.glb')
    expect(getHouse('gross').modelFilename).toBe('rauchhaus.glb')
  })

  it.each(['klein', 'gross'] as const)(
    'places one classroom control per storey in %s',
    (variant) => {
      const house = getHouse(variant)
      const floors = house.classroomSources.map((source) => {
        const room = house.rooms.find((room) => room.id === source.room)
        if (!room) throw new Error(`Unknown compartment for ${source.id}`)
        const [x, y, z] = source.marker
        expect(x).toBeGreaterThan(room.minX)
        expect(x).toBeLessThan(room.maxX)
        expect(y).toBeGreaterThan(room.floorY)
        expect(y).toBeLessThan(room.ceilingY)
        expect(z).toBeGreaterThan(room.minZ)
        expect(z).toBeLessThan(source.position[2])
        expect(Math.hypot(x - source.position[0], y - source.position[1])).toBeGreaterThan(0.5)
        return room.floor
      })
      expect(floors.sort((a, b) => a - b)).toEqual(house.floors.map((f) => f.level))
    },
  )

  const small = getHouse('klein')
  it('connects the right-hand stairwell to one apartment per floor and omits the basement', () => {
    expect(small.floors.map((floor) => floor.level)).toEqual([0, 1, 2, 3])
    for (const floor of small.floors) {
      const landing = small.rooms.find((room) => room.id === floor.landing)
      if (!landing) throw new Error('Missing stair landing')
      const apartments = small.rooms.filter(
        (room) => room.floor === floor.level && room !== landing,
      )
      expect(apartments.length).toBe([2, 1, 2, 1][floor.level])
      expect(apartments.every((room) => room.maxX < landing.minX)).toBe(true)
      expect(small.doors.filter((door) => door.rooms[1] === landing.id)).toHaveLength(1)
      expect(small.dimensions.stairEyeX).toBeGreaterThan(landing.minX)
      expect(small.dimensions.stairEyeX).toBeLessThan(landing.maxX)
    }
    const sim = new SmokeSimulation(small)
    expect(sim.snapshot().doors.entry).toBe(false)
    expect(() => sim.start('s_washer')).toThrow(RangeError)
    expect(() => sim.setDoor('dbr', true)).toThrow(RangeError)
    expect(() => new SmokeSimulation(getHouse('gross')).setDoor('entry', true)).toThrow(RangeError)
  })

  it('keeps the open/closed television comparison visible on both small-house landings', () => {
    function watch(open: boolean) {
      const sim = new SmokeSimulation(small)
      sim.setDoor('d1', open)
      sim.start('s_tv')
      sim.advance(26)
      return sim.snapshot()
    }
    const open = watch(true)
    const closed = watch(false)
    expect(open.detectors.m_living).toBe(true)
    for (const landing of ['stair1', 'stair2'] as const) {
      expect(open.rooms[landing].opacity).toBeGreaterThan(closed.rooms[landing].opacity + 0.15)
      expect(open.rooms[landing].layerBaseY).toBeLessThan(closed.rooms[landing].layerBaseY)
    }
    expect(open.escapedMass).toBe(0)
    expect(mass(open)).toBeCloseTo(mass(closed), 9)
  })

  it('accounts for smoke lost through the exterior entrance and preserves prior losses on closure', () => {
    function kitchen(open: boolean) {
      const sim = new SmokeSimulation(small)
      sim.setDoor('d0', true)
      sim.setDoor('entry', open)
      sim.start('s_stove')
      sim.advance(58)
      return sim
    }
    const sim = kitchen(true)
    const open = sim.snapshot()
    const closed = kitchen(false).snapshot()
    expect(open.doorFlow.entry).toBeGreaterThan(0)
    expect(open.escapedMass).toBeGreaterThan(10 * closed.escapedMass)
    expect(open.rooms.stair0.smokeMass).toBeLessThan(closed.rooms.stair0.smokeMass)
    for (const snapshot of [open, closed])
      expect(mass(snapshot) + snapshot.escapedMass).toBeCloseTo(snapshot.producedMass, 9)
    sim.setDoor('entry', false)
    expect(sim.snapshot().escapedMass).toBe(open.escapedMass)
    sim.advance(6)
    expect(sim.snapshot().escapedMass).toBeGreaterThanOrEqual(open.escapedMass)
    expect(sim.snapshot().doorFlow.entry).toBeLessThan(open.doorFlow.entry / 10)
    const continued = sim.snapshot()
    expect(continued.producedMass).toBeGreaterThan(open.producedMass)
    expect(mass(continued) + continued.escapedMass).toBeCloseTo(continued.producedMass, 9)
    sim.reset()
    expect(sim.snapshot().escapedMass).toBe(0)
    expect(sim.snapshot().producedMass).toBe(0)
  })

  it('fills the playroom before smoke descends in the attic beyond the open stairwell', () => {
    const sim = new SmokeSimulation(small)
    sim.setDoor('d2', true)
    sim.setDoor('d3', true)
    sim.start('s_desk')
    function fill(id: 'playroom' | 'attic'): number {
      const room = small.rooms.find((item) => item.id === id)
      if (!room) throw new Error(`Missing test room: ${id}`)
      return volumeAbove(room, sim.snapshot().rooms[id].layerBaseY) / volumeAbove(room, room.floorY)
    }
    sim.advance(25)
    expect(fill('playroom')).toBeGreaterThan(0.55)
    expect(fill('playroom')).toBeLessThan(0.67)
    expect(fill('attic')).toBe(0)
    sim.advance(15)
    expect(fill('playroom')).toBeGreaterThan(0.73)
    expect(fill('playroom')).toBeLessThan(0.87)
    expect(fill('attic')).toBeLessThan(0.1)
    sim.advance(35)
    expect(fill('attic')).toBeGreaterThan(0.35)
    expect(fill('playroom')).toBeGreaterThan(0.9)
  })

  it.each(['klein', 'gross'] as const)(
    'backs smoke down consecutive stair openings only after upper landings fill in %s',
    (variant) => {
      const house = getHouse(variant)
      const sim = new SmokeSimulation(house)
      sim.setDoor('d2', true)
      sim.start('s_desk')
      sim.advance(40)
      const early = sim.snapshot()
      expect(early.stairFlow.stair2).toBeGreaterThan(0)
      expect(early.rooms.stair3.smokeMass).toBeGreaterThan(0)
      expect(early.rooms.stair1.smokeMass).toBe(0)
      expect(early.stairDownAge.stair1).toBe(0)

      // Catch the first actual transfer rather than a frame late in the spill.
      let first = early
      while (first.stairFlow.stair1 >= 0 && first.elapsed < 70) {
        sim.advance(1 / 30)
        first = sim.snapshot()
      }
      expect(first.stairDownAge.stair1).toBeCloseTo(1 / 30, 12)
      expect(first.rooms.stair1.ceilingFront).toMatchObject({
        x: house.dimensions.stairEyeX,
        z: house.dimensions.stairEyeZ,
        riseRemaining: 0,
      })
      sim.advance(80 - first.elapsed)
      const middle = sim.snapshot()
      expect(middle.stairFlow.stair1).toBeLessThan(-0.1)
      expect(middle.stairDownAge.stair1).toBeGreaterThan(10)
      expect(middle.rooms.stair1.layerBaseY).toBeLessThan(early.rooms.stair1.layerBaseY - 0.45)
      expect(middle.rooms.stair0.smokeMass).toBe(0)

      sim.advance(40)
      const late = sim.snapshot()
      expect(late.stairFlow.stair0).toBeLessThan(-0.1)
      expect(late.rooms.stair0.layerBaseY).toBeLessThan(early.rooms.stair0.layerBaseY - 0.4)
      expect(late.rooms.stair1.layerBaseY).toBeLessThan(middle.rooms.stair1.layerBaseY)
      expect(mass(late) + late.escapedMass).toBeCloseTo(late.producedMass, 8)
      if (variant === 'gross') {
        expect(late.rooms.stairB.smokeMass).toBe(0)
        sim.advance(60)
        expect(sim.snapshot().rooms.stairB.smokeMass).toBeGreaterThan(0)
      }
      sim.reset()
      expect(sim.snapshot().stairDownAge.stair1).toBe(0)
      expect(sim.snapshot().stairFlow.stair1).toBe(0)
    },
  )

  it('delays downward filling while the open attic can still receive smoke', () => {
    const [closedAttic, openAttic] = [false, true].map((open) => {
      const sim = new SmokeSimulation(small)
      sim.setDoor('d2', true)
      sim.setDoor('d3', open)
      sim.start('s_desk')
      sim.advance(60)
      sim.advance(60)
      const snapshot = sim.snapshot()
      sim.advance(60)
      expect(sim.snapshot().rooms.stair0.smokeMass).toBeGreaterThan(0)
      return snapshot.rooms.stair0.smokeMass
    })
    expect(closedAttic).toBeGreaterThan(1)
    expect(openAttic).toBe(0)
  })

  it('shares receiving capacity across openings and keeps mixing through open doors at full volume', () => {
    const door = small.doors.find((item) => item.id === 'i2')
    const bedroom = small.rooms.find((room) => room.id === 'sleep2')
    if (!door || !bedroom) throw new Error('Missing bedroom or internal door')
    // Two identical open paths isolate the final partial transfer at saturation.
    const sim = new SmokeSimulation({ ...small, doors: [door, { ...door, id: 'd2' }] })
    sim.start('s_desk')
    let before = sim.snapshot()
    let after = before
    while (after.rooms.sleep2.layerBaseY > bedroom.floorY && after.elapsed < 60) {
      before = after
      sim.advance(1 / 30)
      after = sim.snapshot()
    }
    expect(after.rooms.sleep2.layerBaseY).toBe(bedroom.floorY)
    expect(after.doorFlow.i2).toBeLessThan(0)
    expect(after.doorFlow.d2).toBe(after.doorFlow.i2)
    const gained =
      volumeAbove(bedroom, bedroom.floorY) - volumeAbove(bedroom, before.rooms.sleep2.layerBaseY)
    const delivered = (2 * Math.abs(after.doorFlow.i2)) / 30
    // The last step admits only the remaining space, including any entrained air.
    expect(delivered).toBeLessThanOrEqual(gained + 1e-9)
    expect(1.12 * delivered).toBeGreaterThanOrEqual(gained - 1e-9)
    sim.advance(25)
    const full = sim.snapshot()
    expect(full.doorFlow.i2).toBe(0)
    expect(full.doorFlow.d2).toBe(0)
    expect(full.doorFlowAge.i2).toBe(0)
    expect(full.doorFlowAge.d2).toBe(0)
    expect(full.rooms.sleep2.layerBaseY).toBe(bedroom.floorY)
    expect(full.rooms.sleep2.smokeMass).toBeGreaterThan(after.rooms.sleep2.smokeMass)
    expect(mass(full)).toBeCloseTo(full.producedMass, 9)
    sim.setDoor('i2', false)
    sim.setDoor('d2', false)
    sim.advance(25)
    expect(sim.snapshot().rooms.sleep2.smokeMass).toBe(full.rooms.sleep2.smokeMass)
  })

  it('dilutes the first smoke from the kettle and enriches the occupied upper landings over time', () => {
    const house = getHouse('gross')
    const sim = new SmokeSimulation(house)
    sim.setDoor('d0l', true)
    sim.start('s_kettle')
    sim.advance(60)
    const first = sim.snapshot()
    expect(first.rooms.stair3.density).toBeGreaterThan(0)
    expect(first.rooms.stair3.density).toBeLessThan(first.rooms.stair0.density - 0.15)
    sim.advance(60)
    const filled = sim.snapshot()
    const attic = house.rooms.find((room) => room.id === 'stair3')
    if (!attic) throw new Error('Missing attic landing')
    expect(volumeAbove(attic, filled.rooms.stair3.layerBaseY)).toBeGreaterThan(
      0.75 * volumeAbove(attic, attic.floorY),
    )
    for (let minute = 0; minute < 3; minute++) sim.advance(60)
    const sustained = sim.snapshot()
    expect(sustained.rooms.stair3.density).toBeGreaterThan(filled.rooms.stair3.density + 0.08)
    expect(sustained.rooms.stair3.density).toBeLessThanOrEqual(sustained.rooms.studio0.density)
    expect(mass(sustained) + sustained.escapedMass).toBeCloseTo(sustained.producedMass, 8)
  })

  it.each([false, true])(
    'keeps a ten-minute smoke budget with the exterior door open = %s',
    (open) => {
      const sim = new SmokeSimulation(small)
      for (const door of small.doors) sim.setDoor(door.id, open)
      sim.start('s_stove')
      for (let minute = 1; minute <= 10; minute++) {
        sim.advance(60)
        const snapshot = sim.snapshot()
        expect(snapshot.sourceStrength).toBe(1)
        expect(snapshot.elapsed).toBe(minute * 60)
        expect(mass(snapshot) + snapshot.escapedMass).toBeCloseTo(snapshot.producedMass, 8)
        for (const room of small.rooms) {
          const layer = snapshot.rooms[room.id]
          expect(layer.layerBaseY).toBeGreaterThanOrEqual(room.floorY)
          expect(layer.layerBaseY).toBeLessThanOrEqual(room.ceilingY)
          expect(layer.smokeMass).toBeGreaterThanOrEqual(0)
          // Inverse height for the gable is resolved to 19 bisection steps.
          expect(layer.smokeMass).toBeLessThanOrEqual(
            0.86 * volumeAbove(room, layer.layerBaseY) + 0.0002,
          )
        }
      }
      const sourceDensity = sim.snapshot().rooms.kitchen.density
      // Return gas through open doors can dilute even a full source room.
      if (open) {
        expect(sourceDensity).toBeGreaterThan(0.8)
        expect(sourceDensity).toBeLessThan(0.86)
      } else {
        expect(sourceDensity).toBeCloseTo(0.86, 3)
      }
    },
  )
})

describe('compartment transport', () => {
  it('places each doorway in the shared wall between its two rooms', () => {
    for (const door of DOORS) {
      const rooms = ROOMS.filter((room) => door.rooms.includes(room.id)).sort(
        (a, b) => a.minX - b.minX,
      )
      expect(rooms).toHaveLength(2)
      const [left, right] = rooms
      expect([left.floor, right.floor]).toEqual([door.floor, door.floor])
      expect(left.maxX).toBeCloseTo(door.x - DIMENSIONS.wallThickness / 2)
      expect(right.minX).toBeCloseTo(door.x + DIMENSIONS.wallThickness / 2)
      expect(door.latchZ).toBeGreaterThan(left.minZ)
      expect(door.hingeZ).toBeLessThan(left.maxZ)
    }
  })

  it('starts with clear rooms, open interior doors and shut apartment doors', () => {
    const sim = new SmokeSimulation()
    sim.advance(10)
    const initial = sim.snapshot()
    expect(initial.elapsed).toBe(0)
    expect(initial.source).toBeNull()
    expect(mass(initial)).toBe(0)
    const open = DOORS.filter((door) => initial.doors[door.id]).map((door) => door.id)
    expect(open.sort()).toEqual(['i0', 'i1', 'i2'])
    for (const landing of FLOORS) {
      const entrances = DOORS.filter((door) => door.rooms.includes(landing.landing))
      expect(entrances).toHaveLength(2)
      expect(entrances.every((door) => !initial.doors[door.id])).toBe(true)
      expect(entrances.map((door) => Math.sign(door.x)).sort()).toEqual([-1, 1])
    }
    for (const room of ROOMS) expect(initial.rooms[room.id].layerBaseY).toBe(room.ceilingY)
  })

  it('builds a descending upper layer before smoke reaches the open lintel', () => {
    const sim = livingTrial(true)
    sim.advance(2)
    const early = sim.snapshot()
    expect(early.rooms.living.smokeMass).toBeGreaterThan(0)
    expect(early.rooms.living.layerBaseY).toBeGreaterThan(4.3)
    expect(outsideLiving(early)).toBe(0)
    sim.advance(6)
    const later = sim.snapshot()
    expect(later.rooms.living.layerBaseY).toBeLessThan(early.rooms.living.layerBaseY)
    expect(later.rooms.stair1.smokeMass).toBeGreaterThan(0)
    expect(later.doorFlow.d1).toBeGreaterThan(0)
    expect(later.rooms.stair0.smokeMass).toBe(0)
  })

  it.each([
    ['klein', 'd1', 'stair1', 1],
    ['gross', 'i1', 'bedroom', -1],
  ] as const)(
    'spills through %s %s in the upper doorway before spreading along the next ceiling',
    (variant, id, receiver, direction) => {
      const house = getHouse(variant)
      const door = house.doors.find((item) => item.id === id)
      if (!door) throw new Error('Missing test doorway')
      const sim = new SmokeSimulation(house)
      sim.setDoor(id, true)
      sim.start('s_tv')
      let snapshot = sim.snapshot()
      while (snapshot.doorFlow[id] === 0 && snapshot.elapsed < 24) {
        expect(snapshot.rooms[receiver].smokeMass).toBe(0)
        sim.advance(1 / 30)
        snapshot = sim.snapshot()
      }
      const firstFlow = direction * snapshot.doorFlow[id]
      expect(firstFlow).toBeGreaterThan(0)
      expect(snapshot.rooms.living.layerBaseY).toBeLessThan(door.topY)
      expect(snapshot.rooms[receiver].smokeMass).toBeGreaterThan(0)
      expect(snapshot.rooms[receiver].ceilingFront).toMatchObject({
        x: door.x,
        z: (door.hingeZ + door.latchZ) / 2,
        radius: 0,
      })
      expect(snapshot.rooms[receiver].ceilingFront?.riseRemaining).toBeGreaterThan(0)
      sim.advance(1)
      const later = sim.snapshot()
      expect(direction * later.doorFlow[id]).toBeGreaterThan(firstFlow)
      expect(later.rooms[receiver].ceilingFront?.riseRemaining).toBe(0)
      expect(later.rooms[receiver].ceilingFront?.radius).toBeGreaterThan(0)
      expect(later.rooms[receiver].ceilingFront?.radius).toBeLessThan(1)
      expect(later.rooms.stair2.smokeMass).toBe(0)
    },
  )

  it('spreads beyond the door as soon as it opens onto an established smoke layer', () => {
    const house = getHouse('klein')
    const sim = new SmokeSimulation(house)
    sim.start('s_tv')
    sim.advance(26)
    const closed = sim.snapshot()
    expect(closed.doorFlowAge.d1).toBe(0)
    const nearDoor = closed.rooms.stair1.ceilingFront
    if (!nearDoor) throw new Error('Expected a small leakage current')
    const distanceToStairs = Math.hypot(
      nearDoor.x - house.dimensions.stairEyeX,
      nearDoor.z - house.dimensions.stairEyeZ,
    )
    expect(nearDoor.radius).toBeLessThan(distanceToStairs)
    expect(closed.rooms.stair2.smokeMass).toBe(0)
    sim.setDoor('d1', true)
    sim.advance(1 / 30)
    const opened = sim.snapshot()
    expect(opened.doorFlowAge.d1).toBeCloseTo(1 / 30, 12)
    expect(opened.doorFlow.d1).toBeGreaterThan(10 * closed.doorFlow.d1)
    expect(opened.rooms.stair1.ceilingFront?.radius).toBeLessThan(distanceToStairs)
    sim.advance(2)
    const spread = sim.snapshot().rooms.stair1.ceilingFront
    expect(spread?.radius).toBeGreaterThan(distanceToStairs)
    expect(sim.snapshot().doorFlowAge.d1).toBeCloseTo(2 + 1 / 30, 10)
    sim.setDoor('d1', false)
    expect(sim.snapshot().doorFlowAge.d1).toBe(0)
    expect(sim.snapshot().rooms.stair1.ceilingFront).toEqual(spread)
    sim.setDoor('d1', true)
    sim.advance(1 / 30)
    expect(sim.snapshot().doorFlowAge.d1).toBeCloseTo(1 / 30, 12)
    sim.start('s_tv')
    expect(sim.snapshot().doorFlowAge.d1).toBe(0)
  })

  it('builds higher concentration and strong optical attenuation as the source room fills', () => {
    const sim = new SmokeSimulation(getHouse('klein'))
    sim.start('s_tv')
    sim.advance(3)
    const early = sim.snapshot().rooms.living
    expect(early.opacity).toBeGreaterThan(0)
    expect(early.opacity).toBeLessThan(0.2)
    sim.advance(40)
    const dense = sim.snapshot().rooms.living
    expect(dense.density).toBeGreaterThan(2 * early.density)
    expect(dense.layerBaseY).toBeLessThan(early.layerBaseY)
    expect(dense.opacity).toBeGreaterThan(0.97)
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
    // The open interior door connects the second room in this apartment.
    expect(a.rooms.bedroom.smokeMass).toBeGreaterThan(0)
    expect(a.rooms.studio1.smokeMass).toBeLessThan(0.001)
    expect(a.rooms.stairB.smokeMass).toBe(0)
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
      sim.advance(28)
      return sim.snapshot()
    }
    const a = compare(true)
    const b = compare(false)
    expect(a.rooms.dining.smokeMass).toBeGreaterThan(10 * b.rooms.dining.smokeMass)
    expect(a.rooms.stair0.smokeMass).toBeGreaterThan(b.rooms.stair0.smokeMass)
    expect(a.rooms.living.smokeMass).toBeLessThan(a.rooms.stair1.smokeMass)
  })

  it('moves smoke from the washer into the basement and up to the ground floor', () => {
    function washer(open: boolean) {
      const sim = new SmokeSimulation()
      sim.setDoor('dbr', open)
      sim.start('s_washer')
      sim.advance(26)
      return sim.snapshot()
    }
    const open = washer(true)
    const closed = washer(false)
    expect(open.detectors.m_laundry).toBe(true)
    expect(open.rooms.storage.smokeMass).toBe(0)
    expect(open.rooms.stairB.smokeMass).toBeGreaterThan(open.rooms.stair0.smokeMass)
    expect(open.rooms.stair0.smokeMass).toBeGreaterThan(open.rooms.stair1.smokeMass)
    for (const id of ['stairB', 'stair0'] as const) {
      expect(open.rooms[id].smokeMass).toBeGreaterThan(10 * closed.rooms[id].smokeMass)
      expect(open.stairFlow[id]).toBeGreaterThan(0)
    }
    expect(mass(open)).toBeCloseTo(mass(closed), 9)
  })

  it.each([
    ['s_washer', 'dbr', 'dbl', 'storage'],
    ['s_tv', 'd1', 'd1r', 'studio1'],
  ] as const)(
    'reaches the opposite side through both doors from %s',
    (source, near, far, opposite) => {
      function compare(nearOpen: boolean, farOpen: boolean) {
        const sim = new SmokeSimulation()
        sim.setDoor(near, nearOpen)
        sim.setDoor(far, farOpen)
        sim.start(source)
        sim.advance(50)
        return sim.snapshot()
      }
      const open = compare(true, true)
      const across = open.rooms[opposite].smokeMass
      expect(across).toBeGreaterThan(0.1)
      expect(across).toBeGreaterThan(10 * compare(true, false).rooms[opposite].smokeMass)
      expect(across).toBeGreaterThan(10 * compare(false, true).rooms[opposite].smokeMass)
      expect(open.doorFlow[near]).toBeGreaterThan(0)
      expect(open.doorFlow[far]).toBeLessThan(0)
    },
  )

  it('detects smoke only when the local layer reaches the actual sensing height', () => {
    const sim = new SmokeSimulation()
    sim.start('s_attic')
    sim.advance(1 / 30)
    expect(Object.values(sim.snapshot().detectors)).not.toContain(true)
    sim.advance(5)
    const snapshot = sim.snapshot()
    expect(
      DETECTORS.filter((sensor) => snapshot.detectors[sensor.id]).map((sensor) => sensor.id),
    ).toEqual(['m_attic'])
    const detector = DETECTORS.find((item) => item.id === 'm_attic')
    if (!detector) throw new Error('Missing detector in the attic')
    expect(snapshot.rooms.attic.layerBaseY).toBeLessThanOrEqual(detector.sensorY)
    expect(snapshot.rooms.playroom.smokeMass).toBe(0)
  })

  it('starts the attic ceiling current where the plume meets the pitched roof', () => {
    const source = SOURCES.find((item) => item.id === 's_loft')
    const room = ROOMS.find((item) => item.id === 'loft')
    if (!source || !room?.roof) throw new Error('Expected an attic source')
    const [x, y, z] = source.position
    const arrival = (roofHeightAt(x, room.roof) - y) / PLUME_RISE_SPEED
    const sim = new SmokeSimulation()
    sim.start(source.id)
    sim.advance(arrival - 1 / 30)
    expect(sim.snapshot().rooms.loft.ceilingFront).toBeNull()
    sim.advance(2 / 30)
    const snapshot = sim.snapshot()
    expect(snapshot.elapsed).toBeLessThan((room.ceilingY - y) / PLUME_RISE_SPEED)
    expect(snapshot.rooms.loft.ceilingFront).toMatchObject({ x, z, riseRemaining: 0 })
  })

  it('fits the upper layer to the pitched roof, including its narrower stair landing', () => {
    for (const room of ROOMS.filter((room) => room.floor === ROOF.floor)) {
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
    'continues producing tracer and bounds every layer for source %s',
    (id) => {
      const sim = new SmokeSimulation()
      sim.start(id)
      for (const door of DOORS) sim.setDoor(door.id, true)
      sim.advance(58)
      const running = sim.snapshot()
      expect(running.sourceStrength).toBe(1)
      expect(mass(running)).toBeGreaterThan(0)
      sim.advance(45)
      const later = sim.snapshot()
      expect(later.sourceStrength).toBe(1)
      expect(later.producedMass).toBeGreaterThan(running.producedMass)
      expect(mass(later)).toBeCloseTo(later.producedMass, 8)
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
