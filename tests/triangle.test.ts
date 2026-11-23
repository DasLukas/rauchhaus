import { describe, expect, it } from 'vitest'
import {
  closestOnSide,
  constrainPoint,
  factorPoint,
  readTriangle,
  TRIANGLE_CENTER,
  TRIANGLE_HEIGHT,
} from '../src/triangle/experiment'

const factors = ['heat', 'oxygen', 'fuel'] as const

describe('triangle control', () => {
  it('places the centre at equal perpendicular distances to the three labelled sides', () => {
    const reading = readTriangle(TRIANGLE_CENTER)
    expect(reading.state).toBe('steady')
    expect(reading.limitingFactor).toBeNull()
    expect(reading.flame).toBe(1)
    for (const factor of factors) {
      const end = closestOnSide(TRIANGLE_CENTER, factor)
      expect(Math.hypot(end.x - TRIANGLE_CENTER.x, end.y - TRIANGLE_CENTER.y)).toBeCloseTo(
        TRIANGLE_HEIGHT / 3,
      )
      expect(reading.availability[factor]).toBeCloseTo(1)
    }
  })

  it.each(factors)(
    'reduces only %s along its comparison path and reaches extinction at the far vertex',
    (factor) => {
      let previous = 1
      for (let step = 0; step <= 50; step++) {
        const strength = step / 50
        const reading = readTriangle(factorPoint(factor, strength))
        expect(reading.availability[factor]).toBeCloseTo(1 - strength)
        for (const other of factors) {
          if (other !== factor) expect(reading.availability[other]).toBeCloseTo(1)
        }
        expect(reading.flame).toBeLessThanOrEqual(previous)
        previous = reading.flame
      }
      const weak = readTriangle(factorPoint(factor, 0.65))
      expect(weak).toMatchObject({ state: 'weak', limitingFactor: factor })
      expect(weak.flame).toBeGreaterThan(0)
      expect(weak.flame).toBeLessThan(1)
      const absent = readTriangle(factorPoint(factor, 1))
      expect(absent).toMatchObject({ flame: 0, state: 'out', limitingFactor: factor })
      expect(absent.availability[factor]).toBeCloseTo(0)
    },
  )

  it('makes the flames visibly shorter at the bottom edge and across the smaller-flames caption', () => {
    const base = readTriangle({ x: 0.495, y: TRIANGLE_HEIGHT })
    expect(base).toMatchObject({ state: 'weak', limitingFactor: 'oxygen' })
    expect(base.flame).toBeLessThan(0.60)

    const justBefore = readTriangle(factorPoint('oxygen', 0.139))
    const justAfter = readTriangle(factorPoint('oxygen', 0.141))
    expect(justBefore.state).toBe('steady')
    expect(justAfter.state).toBe('weak')
    expect(justBefore.flame - justAfter.flame).toBeLessThan(0.01)
    // Each animated tongue can vary by up to 18% from its authored height.
    expect(justAfter.flame * 1.18).toBeLessThan(0.82)
    const guided = readTriangle(factorPoint('oxygen', 0.65))
    expect(guided.flame).toBeGreaterThan(0.15)
    expect(guided.flame).toBeLessThan(base.flame)
  })

  it('keeps the same orthogonal endpoint on a slanted edge when the pointer leaves the control', () => {
    const leftMidpoint = { x: 0.25, y: TRIANGLE_HEIGHT / 2 }
    const outside = { x: leftMidpoint.x - TRIANGLE_HEIGHT * 0.2, y: leftMidpoint.y - 0.1 }
    const bounded = constrainPoint(outside)
    expect(bounded.x).toBeCloseTo(leftMidpoint.x)
    expect(bounded.y).toBeCloseTo(leftMidpoint.y)
    expect(readTriangle(outside).point).toEqual(bounded)
    expect(constrainPoint({ x: 0.7, y: 1.9 })).toEqual({ x: 0.7, y: TRIANGLE_HEIGHT })
    expect(constrainPoint({ x: 0.5, y: -2 })).toEqual(factorPoint('fuel', 1))
  })

  it('does not move a point inside the control and accepts its boundary vertices', () => {
    const inside = { x: 0.54, y: 0.32 }
    expect(constrainPoint(inside)).toEqual(inside)
    for (const factor of factors) {
      const vertex = factorPoint(factor, 1)
      expect(constrainPoint(vertex)).toEqual(vertex)
    }
    expect(constrainPoint({ x: Number.NaN, y: 0.4 })).toEqual(TRIANGLE_CENTER)
  })
})
