import { describe, expect, it } from 'vitest'
import {
  factorPoint,
  readTriangle,
  STOVE_START_ANGLE,
  TRIANGLE_CENTER,
} from '../src/triangle/experiment'
import { TriangleSession } from '../src/triangle/lesson'

describe('guided wood comparisons', () => {
  it('holds predictions until the class starts each comparison', () => {
    const session = new TriangleSession()
    session.begin(0)
    session.move(factorPoint('oxygen', 1))
    session.showObservation()
    expect(session.phase).toBe('predict')
    expect(session.position).toEqual(TRIANGLE_CENTER)
  })

  it('isolates one changing condition even if a child drags diagonally off the comparison path', () => {
    const session = new TriangleSession()
    session.begin(0)
    session.next()
    const intended = factorPoint('oxygen', 0.4)
    session.move({ x: intended.x, y: intended.y - 0.07 })
    const reading = readTriangle(session.position)
    expect(session.phase).toBe('explore')
    expect(reading.limitingFactor).toBe('oxygen')
    expect(reading.availability.heat).toBeCloseTo(1)
    expect(reading.availability.fuel).toBeCloseTo(1)
  })

  it('shows a movement guide only while exploring each of the two oxygen stops', () => {
    const session = new TriangleSession()
    expect(session.guide).toBeNull()
    session.begin(0)
    expect(session.guide).toBeNull()
    session.next()
    const firstTarget = factorPoint('oxygen', 0.65)
    expect(session.guide).toEqual({ from: TRIANGLE_CENTER, to: firstTarget })
    session.showObservation()
    expect(session.guide).toBeNull()
    session.next()
    expect(session.guide).toEqual({ from: firstTarget, to: factorPoint('oxygen', 1) })
    session.showObservation()
    expect(session.guide).toBeNull()
    for (const factor of ['heat', 'fuel']) {
      session.next()
      session.next()
      expect(session.comparison.factor).toBe(factor)
      expect(session.guide).toBeNull()
      session.showObservation()
    }
  })

  it('matches hand and shortcut observations throughout the three trials', () => {
    const hand = new TriangleSession()
    const shortcut = new TriangleSession()
    hand.begin(0)
    shortcut.begin(0)
    for (const factor of ['oxygen', 'heat', 'fuel'] as const) {
      expect(hand.comparison.factor).toBe(factor)
      expect(hand.position).toEqual(TRIANGLE_CENTER)
      hand.next()
      shortcut.next()
      const outcomes = factor === 'oxygen' ? ['weak', 'out'] : ['out']
      for (const outcome of outcomes) {
        hand.move(factorPoint(factor, 1))
        shortcut.next()
        expect(hand.phase).toBe('discuss')
        expect(hand.position).toEqual(shortcut.position)
        expect(readTriangle(hand.position).limitingFactor).toBe(factor)
        expect(readTriangle(hand.position).state).toBe(outcome)
        hand.move(TRIANGLE_CENTER)
        expect(hand.position).toEqual(shortcut.position)
        hand.next()
        shortcut.next()
      }
    }
    expect(hand.phase).toBe('transfer')
    hand.next()
    expect(hand.phase).toBe('result')
    hand.next()
    expect(hand.phase).toBe('free')
  })

  it('lets pupils select, revise, or speak a prediction without giving away the observation', () => {
    const session = new TriangleSession()
    session.begin(0)
    expect(session.prediction).toBeNull()
    session.choose('charred')
    expect(session.prediction).toBeNull()
    session.choose('steady')
    session.choose('weak')
    expect(session.prediction).toBe('weak')
    expect(session.position).toEqual(TRIANGLE_CENTER)
    session.choose('weak')
    expect(session.prediction).toBeNull()
    session.choose('wood')
    session.next()
    session.choose('steady')
    session.showObservation()
    expect(session.prediction).toBe('wood')
    expect(readTriangle(session.position).state).toBe('weak')
    session.next()
    session.showObservation()
    expect(readTriangle(session.position).state).toBe('out')
    session.next()
    expect(session.comparison.factor).toBe('heat')
    expect(session.prediction).toBeNull()
    expect(session.comparison.choices).toEqual(expect.arrayContaining(['wood', 'charred']))
    session.next()
    session.showObservation()
    session.next()
    expect(session.comparison.factor).toBe('fuel')
    expect(session.comparison.choices).toEqual(expect.arrayContaining(['wood', 'charred']))
    session.choose('charred')
    session.next()
    session.showObservation()
    expect(session.prediction).toBe('charred')
    expect(session.stop.observation).toContain('verkohlten Rest')
  })

  it('continues the second oxygen comparison from the weaker flame without changing the other two factors', () => {
    const session = new TriangleSession()
    session.begin(0)
    session.next()
    session.showObservation()
    const weaker = session.position
    session.next()
    expect(session.phase).toBe('explore')
    expect(session.position).toEqual(weaker)
    session.move(TRIANGLE_CENTER)
    expect(session.position).toEqual(weaker)
    session.move(factorPoint('oxygen', 1))
    expect(readTriangle(session.position).availability).toEqual({ heat: 1, oxygen: 0, fuel: 1 })
    session.next()
    expect(session.position).toEqual(TRIANGLE_CENTER)
  })

  it('preserves free position and camera angle on early exit and completion', () => {
    for (const complete of [false, true]) {
      const session = new TriangleSession()
      const point = factorPoint('fuel', 0.42)
      session.move(point)
      session.begin(-0.18)
      session.begin(0)
      session.next()
      session.move(factorPoint('oxygen', 0.3))
      if (complete) {
        for (let i = 0; i < 12; i++) session.next()
      } else session.end()
      expect(session.phase).toBe('free')
      expect(session.position).toEqual(point)
      expect(session.viewAngle).toBe(-0.18)
    }
  })

  it('restarts at the free burning baseline from a guided trial', () => {
    const session = new TriangleSession()
    session.move(factorPoint('heat', 1))
    session.begin(0.12)
    session.next()
    session.showObservation()
    session.restart()
    expect(session.phase).toBe('free')
    expect(session.position).toEqual(TRIANGLE_CENTER)
    expect(session.viewAngle).toBe(STOVE_START_ANGLE)
  })
})
