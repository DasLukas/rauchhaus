import { describe, expect, it } from 'vitest'
import {
  factorPoint,
  readTriangle,
  STOVE_START_ANGLE,
  TRIANGLE_CENTER,
} from '../src/triangle/experiment'
import { TriangleSession } from '../src/triangle/lesson'

describe('guided wood comparisons', () => {
  it('opens directly on the first arrow with all three conditions sufficient', () => {
    const session = new TriangleSession()
    expect(session.guide).toBeNull()
    session.begin(0.14)
    expect(session.phase).toBe('explore')
    expect(session.trial.factor).toBe('oxygen')
    expect(readTriangle(session.position).state).toBe('steady')
    expect(session.guide).toEqual({ from: TRIANGLE_CENTER, to: factorPoint('oxygen', 0.65) })
  })

  it('isolates one changing condition even if a child drags diagonally or backwards', () => {
    const session = new TriangleSession()
    session.begin(0)
    const intended = factorPoint('oxygen', 0.4)
    session.move({ x: intended.x, y: intended.y - 0.07 })
    const reading = readTriangle(session.position)
    expect(session.phase).toBe('explore')
    expect(reading.limitingFactor).toBe('oxygen')
    expect(reading.availability.heat).toBeCloseTo(1)
    expect(reading.availability.fuel).toBeCloseTo(1)
    session.move(factorPoint('heat', 0.5))
    expect(session.position).toEqual(TRIANGLE_CENTER)
  })

  it('gives dragging and the show button the same three observations, with a fresh baseline each time', () => {
    const hand = new TriangleSession()
    const button = new TriangleSession()
    hand.begin(0)
    button.begin(0)
    for (const [index, factor] of (['oxygen', 'heat', 'fuel'] as const).entries()) {
      expect(hand.number).toBe(index + 1)
      expect(hand.total).toBe(3)
      expect(hand.trial.factor).toBe(factor)
      expect(hand.position).toEqual(TRIANGLE_CENTER)
      const target = factorPoint(factor, factor === 'oxygen' ? 0.65 : 1)
      expect(hand.guide).toEqual({ from: TRIANGLE_CENTER, to: target })

      hand.move(target)
      button.next()
      expect(hand.phase).toBe('observe')
      expect(button.phase).toBe('observe')
      expect(hand.guide).toBeNull()
      expect(hand.position).toEqual(target)
      expect(hand.position).toEqual(button.position)
      expect(readTriangle(hand.position).limitingFactor).toBe(factor)
      expect(readTriangle(hand.position).state).toBe(factor === 'oxygen' ? 'weak' : 'out')
      hand.move(TRIANGLE_CENTER)
      expect(hand.position).toEqual(target)
      hand.next()
      button.next()
    }
    expect(hand.phase).toBe('free')
    expect(button.phase).toBe('free')
  })

  it.each([0, 1, 3, 6])('restores the original setting and camera after %i advances', (advances) => {
    const session = new TriangleSession()
    const point = factorPoint('fuel', 0.42)
    session.move(point)
    session.begin(-0.18)
    session.begin(0)
    for (let i = 0; i < advances; i++) session.next()
    if (advances < 6) session.end()
    expect(session.phase).toBe('free')
    expect(session.position).toEqual(point)
    expect(session.viewAngle).toBe(-0.18)
    session.begin(session.viewAngle)
    expect(session.number).toBe(1)
    expect(session.phase).toBe('explore')
  })

  it('restarts at the free burning baseline from a guided trial', () => {
    const session = new TriangleSession()
    session.move(factorPoint('heat', 1))
    session.begin(0.12)
    session.next()
    session.next()
    session.restart()
    expect(session.phase).toBe('free')
    expect(session.position).toEqual(TRIANGLE_CENTER)
    expect(session.viewAngle).toBe(STOVE_START_ANGLE)
  })
})
