import { describe, expect, it } from 'vitest'

import { aimPoints, pointAlong, polylineLength } from './fireLine'

const line = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
]

describe('fireLine', () => {
  it('calculates the polyline length', () => {
    expect(polylineLength(line)).toBe(100)
    expect(polylineLength([...line, { x: 100, y: 50 }])).toBe(150)
    expect(polylineLength([line[0]])).toBe(0)
  })

  it('finds a point on the polyline', () => {
    const bent = [...line, { x: 100, y: 50 }]
    expect(pointAlong(bent, 50)).toEqual({ x: 50, y: 0 })
    expect(pointAlong(bent, 125)).toEqual({ x: 100, y: 25 })
    expect(pointAlong(bent, 999)).toEqual({ x: 100, y: 50 })
  })

  it('a single point for a short line, in the middle', () => {
    const points = aimPoints(line, 60)
    expect(points).toEqual([{ x: 50, y: 0 }])
  })

  it('places the points so that the zones cover the whole line', () => {
    const radius = 15
    const long = [{ x: 0, y: 0 }, { x: 200, y: 0 }]
    const points = aimPoints(long, radius)
    // 200 / 30 → 7 bursts
    expect(points).toHaveLength(7)
    for (let d = 0; d <= 200; d += 1) {
      const nearest = Math.min(...points.map((p) => Math.abs(p.x - d)))
      expect(nearest).toBeLessThanOrEqual(radius + 1e-9)
    }
  })

  it('no line: empty; a line of one point: one burst', () => {
    expect(aimPoints([], 15)).toEqual([])
    expect(aimPoints([{ x: 5, y: 5 }], 15)).toEqual([{ x: 5, y: 5 }])
  })
})
