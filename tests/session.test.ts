import { describe, expect, it } from 'vitest'
import { getHouse } from '../src/simulation'
import { sampleGasFlame } from '../src/simulation/gas-flame'
import { LearningSession, OBSERVATION_SECONDS } from '../src/ui/session'

describe('free exploration', () => {
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

  it.each(house.classroomSources)('reaches flashover at $label from the fire preset and respects closed doors', (source) => {
    const roomDoors = house.doors.filter((door) => door.rooms.includes(source.room))
    const ventilated = new LearningSession(house)
    ventilated.setFireEnabled(true)
    expect(roomDoors.some((door) => ventilated.snapshot.doors[door.id])).toBe(true)
    ventilated.selectSource(source.id)
    expect(ventilated.snapshot.fire?.phase).toBe('local')
    let sawGasFlames = false
    for (let second = 0; second < 45; second++) {
      const fire = ventilated.tick(1).fire
      if (fire?.phase === 'rollover' && fire.rollover >= 0.45) sawGasFlames = true
      if (fire?.phase === 'flashover') break
    }
    expect(sawGasFlames).toBe(true)
    expect(ventilated.snapshot.fire?.phase).toBe('flashover')
    expect(ventilated.tick(5).fire?.involvement).toBeGreaterThan(0.65)

    const closed = new LearningSession(house)
    closed.setFireEnabled(true)
    for (const door of roomDoors) {
      if (closed.snapshot.doors[door.id]) closed.toggleDoor(door.id)
    }
    closed.selectSource(source.id)
    const limited = closed.tick(60)
    expect(limited.rooms[source.room].smokeMass).toBeGreaterThan(0)
    expect(limited.fire).toMatchObject({ phase: 'local', involvement: 0 })
  })

  it('keeps manual doors across source changes and restores the preset on mode change or restart', () => {
    const session = new LearningSession(house)
    const smokeDoors = session.snapshot.doors
    session.setFireEnabled(true)
    const fireDoors = session.snapshot.doors
    expect(fireDoors.d3).toBe(true)
    for (const door of house.doors.filter((item) => item.initiallyOpen)) {
      expect(fireDoors[door.id]).toBe(true)
    }
    session.setFireEnabled(false)
    expect(session.snapshot.doors).toEqual(smokeDoors)

    session.toggleDoor('d0')
    session.setFireEnabled(true)
    expect(session.snapshot.doors).toEqual(fireDoors)
    session.toggleDoor('d3')
    session.selectSource('s_tv')
    expect(session.snapshot.doors.d3).toBe(false)
    session.restart()
    expect(session.fireEnabled).toBe(true)
    expect(session.snapshot.source).toBeNull()
    expect(session.snapshot.doors).toEqual(fireDoors)
    session.selectSource('s_attic')
    expect(session.tick(45).fire?.phase).toBe('flashover')
    session.setFireEnabled(false)
    expect(session.snapshot.doors).toEqual(smokeDoors)
  })
})

describe('guided door comparison', () => {
  it('compares the same source at the same time, with just one initial door position changed', () => {
    const session = new LearningSession()
    session.beginLesson()
    const openStart = session.snapshot
    expect(session.stage).toBe('open')
    expect(openStart.source).toBe('s_tv')
    expect(openStart.doors.d1).toBe(true)
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
    'restores the free experiment including its paused state (%s)',
    (paused) => {
      const session = new LearningSession()
      session.selectSource('s_washer')
      session.toggleDoor('dbr')
      session.tick(6.41)
      if (paused) session.togglePause()
      const free = session.snapshot

      session.beginLesson()
      session.tick(5)
      session.beginLesson()
      expect(session.snapshot.elapsed).toBe(5)
      session.endLesson()
      expect(session.stage).toBeNull()
      expect(session.paused).toBe(paused)
      expect(session.snapshot).toBe(free)
      expect(session.tick(1).elapsed).toBeCloseTo(free.elapsed + (paused ? 0 : 1))
    },
  )
})

describe('optional fire lesson', () => {
  it('starts in smoke mode and keeps the selected option across a house reset', () => {
    const session = new LearningSession()
    session.beginLesson('fire')
    expect(session.stage).toBeNull()
    expect(session.fireEnabled).toBe(false)
    session.selectSource('s_tv')
    session.tick(12)
    session.togglePause()
    session.setFireEnabled(true)
    expect(session.snapshot.source).toBeNull()
    expect(session.snapshot.elapsed).toBe(0)
    expect(session.snapshot.producedMass).toBe(0)
    expect(session.paused).toBe(false)
    session.restart()
    expect(session.fireEnabled).toBe(true)
    expect(session.snapshot.source).toBeNull()
    expect(session.snapshot.fire).toBeNull()
    session.selectSource('s_tv')
    expect(session.snapshot.fire?.phase).toBe('local')
  })

  it.each(['klein', 'gross'] as const)(
    'halts at visible fire in the gas layer and on room contents in the %s house',
    (variant) => {
      const session = new LearningSession(getHouse(variant))
      session.setFireEnabled(true)
      session.selectSource('s_tv')
      session.tick(5)
      const free = session.snapshot
      session.beginLesson('fire')
      expect(session.snapshot.doors.d1).toBe(true)
      expect(session.snapshot.fire?.phase).toBe('local')
      expect(session.trialFinished).toBe(false)
      session.finishTrial()
      expect(session.fireObservation).toBe('rollover')
      expect(session.snapshot.fire?.phase).toBe('rollover')
      expect(session.snapshot.fire?.rollover).toBeGreaterThanOrEqual(0.45)
      expect(sampleGasFlame(session.snapshot.elapsed, 's_tv').strength).toBeGreaterThanOrEqual(0.8)
      expect(session.snapshot.fire?.involvement).toBe(0)
      const first = session.snapshot
      expect(session.tick(1)).toBe(first)
      session.nextTrial()
      for (let frame = 0; frame < 240 && !session.trialFinished; frame++) session.tick(0.2)
      expect(session.fireObservation).toBe('flashover')
      expect(session.snapshot.fire?.phase).toBe('flashover')
      expect(session.snapshot.fire?.involvement).toBeGreaterThanOrEqual(0.65)
      expect(session.snapshot.elapsed).toBeGreaterThan(first.elapsed)
      expect(session.snapshot.elapsed).toBeLessThan(45)
      expect(session.paused).toBe(true)
      session.nextTrial()
      expect(session.stage).toBe('fire-result')
      session.endLesson()
      expect(session.snapshot).toBe(free)
      expect(session.paused).toBe(false)
    },
  )

  it.each(['fire', 'doors'] as const)('resets the %s lesson and paused free experiment when fire is disabled', (lesson) => {
    const session = new LearningSession()
    const initial = session.snapshot
    session.setFireEnabled(true)
    session.toggleDoor('d1')
    session.selectSource('s_washer')
    session.tick(6.41)
    session.togglePause()
    session.beginLesson(lesson)
    session.finishTrial()
    session.setFireEnabled(false)
    expect(session.stage).toBeNull()
    expect(session.snapshot).toEqual(initial)
    expect(session.paused).toBe(false)
  })

  it('keeps the matched door comparison available with the setting enabled', () => {
    const session = new LearningSession()
    session.setFireEnabled(true)
    session.beginLesson()
    expect(session.stage).toBe('open')
    session.finishTrial()
    expect(session.snapshot.elapsed).toBe(OBSERVATION_SECONDS)
    expect(session.snapshot.fire).toBeNull()
    session.nextTrial()
    expect(session.stage).toBe('closed')
    session.endLesson()
    expect(session.fireEnabled).toBe(true)
  })
})
