import { describe, expect, it } from 'vitest'
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
    expect(session.snapshot.source).toBe('s_stove')
    expect(session.snapshot.elapsed).toBe(0)
    expect(session.snapshot.doors.i0).toBe(false)
    expect(session.snapshot.doors.d0).toBe(true)
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
    expect(session.snapshot.source).toBe('s_tv')
    expect(session.snapshot.doors).toEqual(paused.doors)
    expect(session.snapshot.producedMass).toBe(0)
    expect(session.snapshot.elapsed).toBe(0)
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

  it('can finish a paused trial with a partial tick and repeat that trial from the beginning', () => {
    const session = new LearningSession()
    session.beginLesson()
    session.tick(OBSERVATION_SECONDS - 0.041)
    session.togglePause()
    session.finishTrial()
    expect(session.snapshot.elapsed).toBe(OBSERVATION_SECONDS)
    const end = session.snapshot
    session.finishTrial()
    expect(session.snapshot).toBe(end)
    session.restart()
    expect(session.snapshot.elapsed).toBe(0)
    expect(session.snapshot.doors.d1).toBe(true)
    session.finishTrial()
    expect(session.snapshot).toEqual(end)
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
