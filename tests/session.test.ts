import { describe, expect, it } from 'vitest'
import { getHouse } from '../src/simulation'
import { sampleGasBursts } from '../src/simulation/gas-flame'
import { LearningSession, OBSERVATION_SECONDS } from '../src/ui/session'

describe('free exploration', () => {
  it('keeps the current experiment on a repeat tap, including while paused', () => {
    const session = new LearningSession()
    expect(session.selectSource('s_tv')).toBe(true)
    const running = session.tick(3)
    expect(session.selectSource('s_tv')).toBe(false)
    expect(session.snapshot).toBe(running)
    expect(session.tick(1).elapsed).toBe(4)

    session.togglePause()
    const paused = session.snapshot
    expect(session.selectSource('s_tv')).toBe(false)
    expect(session.tick(1)).toBe(paused)
    expect(session.selectSource('s_desk')).toBe(false)
    expect(session.snapshot).toBe(paused)
    session.restart()
    expect(session.selectSource('s_desk')).toBe(true)
    expect(session.paused).toBe(false)
    expect(session.snapshot.elapsed).toBe(0)
  })

  it('allows door setup before a source, and freezes the complete snapshot on pause', () => {
    const session = new LearningSession()
    session.togglePause()
    session.restart()
    expect(session.snapshot.source).toBeNull()
    session.toggleDoor('i0')
    session.selectSource('s_stove')
    session.tick(8)
    session.togglePause()
    const paused = session.snapshot
    expect(session.tick(12)).toBe(paused)
    session.toggleDoor('d0')
    expect(session.snapshot.rooms).toEqual(paused.rooms)
    expect(session.snapshot.doors.d0).toBe(true)
    session.togglePause()
    expect(session.tick(1).elapsed).toBe(9)

    session.restart()
    expect(session.snapshot.source).toBeNull()
    expect(session.snapshot.elapsed).toBe(0)
    expect(session.snapshot.doors.i0).toBe(true)
    expect(session.snapshot.doors.d0).toBe(false)
    session.selectSource('s_candle')
    expect(session.snapshot.rooms.kitchen.smokeMass).toBe(0)
    expect(session.tick(2).rooms.dining.smokeMass).toBeGreaterThan(0)
  })

  it('pauses and restarts a long-running free experiment without replaying the paused time', () => {
    const session = new LearningSession()
    session.selectSource('s_tv')
    session.tick(60)
    session.togglePause()
    const paused = session.snapshot
    expect(paused.sourceStrength).toBe(1)
    expect(session.tick(60)).toBe(paused)
    session.togglePause()
    const resumed = session.tick(10)
    expect(resumed.elapsed).toBe(70)
    expect(resumed.producedMass).toBeGreaterThan(paused.producedMass)
    session.restart()
    expect(session.snapshot.source).toBeNull()
    expect(session.snapshot.doors).toEqual(paused.doors)
    expect(session.snapshot.producedMass).toBe(0)
    expect(session.snapshot.elapsed).toBe(0)
  })
})

describe.each(['klein', 'gross'] as const)('free fire experiments in the %s house', (variant) => {
  const house = getHouse(variant)

  it.each(house.classroomSources)('keeps flames at $label while smoke spreads according to the doors', (source) => {
    const session = new LearningSession(house)
    expect(session.snapshot.fire).toBeNull()
    // Even an open source room keeps a local fire in the free experiment.
    for (const door of house.doors.filter((door) => door.rooms.includes(source.room))) {
      if (!session.snapshot.doors[door.id]) session.toggleDoor(door.id)
    }
    const doors = session.snapshot.doors
    session.selectSource(source.id)
    const fire = session.snapshot.fire
    expect(fire).toMatchObject({ phase: 'local', rollover: 0, involvement: 0 })
    expect(fire?.sourceIntensity).toBeGreaterThan(0)
    const developed = session.tick(60)
    expect(developed.rooms[source.room].smokeMass).toBeGreaterThan(0)
    expect(developed.fire).toEqual(fire)
    expect(developed.doors).toEqual(doors)
    session.restart()
    expect(session.snapshot.fire).toBeNull()
    for (const door of house.doors) expect(session.snapshot.doors[door.id]).toBe(door.initiallyOpen)
  })
})

describe('guided door comparison', () => {
  it('moves the timer between simulation ticks and holds it while paused', () => {
    const session = new LearningSession()
    session.beginLesson()
    for (let frame = 1; frame <= 3; frame++) {
      session.tick(1 / 120)
      expect(session.trialProgress).toBeCloseTo(frame / 120 / OBSERVATION_SECONDS, 10)
    }
    const progress = session.trialProgress
    session.togglePause()
    session.tick(1)
    expect(session.trialProgress).toBe(progress)
    session.finishTrial()
    expect(session.trialProgress).toBe(1)
    session.nextTrial()
    expect(session.trialProgress).toBe(0)
  })

  it.each(['klein', 'gross'] as const)('compares the same local fire with one door changed in %s', (variant) => {
    const session = new LearningSession(getHouse(variant))
    session.beginLesson()
    const openStart = session.snapshot
    expect(session.stage).toBe('open')
    expect(openStart.source).toBe('s_tv')
    expect(openStart.doors.d1).toBe(true)
    expect(openStart.fire).toMatchObject({ phase: 'local', rollover: 0, involvement: 0 })
    session.toggleDoor('d1')
    session.selectSource('s_stove')
    expect(session.snapshot).toBe(openStart)

    session.tick(OBSERVATION_SECONDS - 1 / 30)
    expect(session.trialFinished).toBe(false)
    session.tick(2)
    const openEnd = session.snapshot
    expect(openEnd.elapsed).toBe(OBSERVATION_SECONDS)
    expect(session.paused).toBe(true)
    session.togglePause()
    expect(session.tick(1)).toBe(openEnd)

    session.nextTrial()
    expect(session.stage).toBe('closed')
    expect(session.snapshot).toEqual({
      ...openStart,
      doors: { ...openStart.doors, d1: false },
    })
    session.tick(3.017)
    session.togglePause()
    session.finishTrial()
    const closedEnd = session.snapshot
    expect(closedEnd.elapsed).toBe(openEnd.elapsed)
    expect(openEnd.fire).toEqual(openStart.fire)
    expect(closedEnd.fire).toEqual(openStart.fire)
    expect(openEnd.rooms.stair1.opacity).toBeGreaterThan(closedEnd.rooms.stair1.opacity)
    session.nextTrial()
    expect(session.stage).toBe('compare')
    expect(session.paused).toBe(true)
    session.finishTrial()
    expect(session.tick(1)).toBe(closedEnd)
  })

  it('can finish a paused trial with a partial tick and reset the whole house from a lesson', () => {
    const session = new LearningSession()
    const initial = session.snapshot
    session.toggleDoor('d0')
    session.selectSource('s_tv')
    session.beginLesson()
    session.tick(OBSERVATION_SECONDS - 0.041)
    session.togglePause()
    session.finishTrial()
    expect(session.snapshot.elapsed).toBe(OBSERVATION_SECONDS)
    const end = session.snapshot
    session.finishTrial()
    expect(session.snapshot).toBe(end)
    session.restart()
    expect(session.stage).toBeNull()
    expect(session.paused).toBe(false)
    expect(session.tick(10)).toEqual(initial)
  })

  it.each([false, true])(
    'clears the previous experiment on exit (previously paused: %s)',
    (paused) => {
      const session = new LearningSession()
      const initial = session.snapshot
      session.selectSource('s_washer')
      session.toggleDoor('dbr')
      session.tick(6.41)
      if (paused) session.togglePause()

      session.beginLesson()
      session.tick(5)
      session.beginLesson()
      expect(session.snapshot.elapsed).toBe(5)
      session.endLesson()
      expect(session.stage).toBeNull()
      expect(session.paused).toBe(false)
      expect(session.snapshot).toEqual(initial)
      expect(session.tick(1).elapsed).toBe(0)
    },
  )
})

describe('guided fire development', () => {
  it('varies between one and two separated tongues and keeps a paused burst stable', () => {
    const counts = new Set<number>()
    for (let slot = 0; slot < 30; slot++) {
      const elapsed = (slot + 0.5) * 1.55
      const bursts = sampleGasBursts(elapsed, 's_tv', 42)
      expect(bursts.every((burst) => burst.strength > 0)).toBe(true)
      expect(new Set(bursts.map((burst) => burst.band)).size).toBe(bursts.length)
      expect(sampleGasBursts(elapsed, 's_tv', 42)).toEqual(bursts)
      counts.add(bursts.length)
    }
    expect(counts).toEqual(new Set([1, 2]))
  })

  it.each(['klein', 'gross'] as const)(
    'halts at visible fire in the gas layer and on room contents in the %s house',
    (variant) => {
      const session = new LearningSession(getHouse(variant))
      const initial = session.snapshot
      session.selectSource('s_tv')
      session.tick(5)
      session.beginLesson('fire')
      expect(session.trialProgress).toBe(0)
      session.tick(1)
      const progress = session.trialProgress
      expect(progress).toBeGreaterThan(0)
      session.togglePause()
      session.tick(2)
      expect(session.trialProgress).toBe(progress)
      session.togglePause()
      expect(session.snapshot.doors.d1).toBe(true)
      expect(session.snapshot.fire?.phase).toBe('local')
      expect(session.trialFinished).toBe(false)
      session.finishTrial()
      expect(session.fireObservation).toBe('rollover')
      expect(session.snapshot.fire?.phase).toBe('rollover')
      expect(session.snapshot.fire?.rollover).toBeGreaterThanOrEqual(0.45)
      const fire = session.snapshot.fire
      expect.assert(fire)
      for (const burst of sampleGasBursts(session.snapshot.elapsed, 's_tv', fire.burstSeed)) {
        expect(burst.strength).toBeGreaterThanOrEqual(0.88)
      }
      expect(session.snapshot.fire?.involvement).toBe(0)
      expect(session.trialProgress).toBe(1)
      const first = session.snapshot
      expect(session.tick(1)).toBe(first)
      session.nextTrial()
      expect(session.trialProgress).toBe(0)
      session.finishTrial()
      expect(session.paused).toBe(false)
      expect(session.snapshot.fire?.outgassing).toBeGreaterThanOrEqual(0.85)
      expect(session.snapshot.fire?.involvement).toBe(0)
      session.tick(1)
      expect(session.snapshot.fire?.involvement).toBe(0)
      for (let frame = 0; frame < 240 && !session.trialFinished; frame++) session.tick(0.2)
      expect(session.outgassingSnapshot?.fire?.outgassing).toBeGreaterThanOrEqual(0.85)
      expect(session.outgassingSnapshot?.fire?.involvement).toBe(0)
      expect(session.fireObservation).toBe('flashover')
      expect(session.snapshot.fire?.phase).toBe('flashover')
      expect(session.snapshot.fire?.involvement).toBeGreaterThanOrEqual(0.65)
      expect(session.snapshot.elapsed).toBeGreaterThan(first.elapsed)
      expect(session.snapshot.elapsed).toBeLessThan(45)
      expect(session.paused).toBe(true)
      session.nextTrial()
      expect(session.stage).toBe('fire-result')
      session.endLesson()
      expect(session.snapshot).toEqual(initial)
      expect(session.paused).toBe(false)
    },
  )

  it.each(['fire', 'doors'] as const)('resets the house when exiting or restarting the %s lesson', (lesson) => {
    const session = new LearningSession()
    const initial = session.snapshot
    session.toggleDoor('d1')
    session.selectSource('s_washer')
    session.tick(6.41)
    session.togglePause()
    session.beginLesson(lesson)
    session.finishTrial()
    session.endLesson()
    expect(session.snapshot).toEqual(initial)
    expect(session.paused).toBe(false)
    session.beginLesson(lesson)
    session.restart()
    expect(session.stage).toBeNull()
    expect(session.snapshot).toEqual(initial)
    expect(session.paused).toBe(false)
  })
})
