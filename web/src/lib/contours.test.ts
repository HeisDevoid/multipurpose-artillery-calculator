import { describe, expect, it } from 'vitest'

import { contourInterval, demContours, majorEvery } from './contours'
import type { Heightmap } from './heightmap'

function makeMap(height: (x: number, y: number) => number, size = 41, step = 25): Heightmap {
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) heights[j * size + i] = height(i * step, j * step)
  }
  return { world: 'test', worldSize: (size - 1) * step, step, size, heights }
}

const wholeMap = { x0: 0, y0: 1000, scale: 1, width: 1000, height: 1000 }

describe('contourInterval', () => {
  it('the closer, the denser; at a small scale there are no lines', () => {
    expect(contourInterval(0.05)).toBeNull()
    expect(contourInterval(0.3)).toBe(5)
    expect(contourInterval(1)).toBe(2)
    expect(contourInterval(3)).toBe(1)
    expect(majorEvery(1)).toBe(5)
    expect(majorEvery(5)).toBe(25)
  })
})

describe('demContours', () => {
  it('an inclined plane: the height lines stand at x = height and are vertical', () => {
    // The height equals x / 5: from 0 to 200 m
    const map = makeMap((x) => x / 5)
    const levels = demContours(map, wholeMap, 10)
    // The zero height line runs along the map edge (the height is 0 there); 200 is the top, no line
    expect(levels.map((l) => l.level)).toEqual(Array.from({ length: 20 }, (_, k) => k * 10))
    const l50 = levels.find((l) => l.level === 50)!
    for (let s = 0; s < l50.segments.length; s += 4) {
      const [ax, ay, bx, by] = l50.segments.slice(s, s + 4)
      // x = 250 m (height 50 at x/5)
      expect(ax).toBeCloseTo(250, 2)
      expect(bx).toBeCloseTo(250, 2)
      expect(Math.abs(ay - by)).toBeCloseTo(25, 3)
    }
    // The line crosses the whole map vertically: 1000 m of 25 m segments
    expect(l50.segments.length / 4).toBe(40)
  })

  it('a hill gives closed lines: the ring length is about 2πr', () => {
    const map = makeMap((x, y) => Math.max(0, 100 - Math.hypot(x - 500, y - 500) / 4))
    const level = demContours(map, wholeMap, 10).find((l) => l.level === 50)!
    // Height 50 at 200 m from the top
    let length = 0
    for (let s = 0; s < level.segments.length; s += 4) {
      length += Math.hypot(level.segments[s + 2] - level.segments[s], level.segments[s + 3] - level.segments[s + 1])
    }
    expect(length).toBeGreaterThan(2 * Math.PI * 200 * 0.95)
    expect(length).toBeLessThan(2 * Math.PI * 200 * 1.05)
  })

  it('only the visible part is calculated', () => {
    const map = makeMap((x) => x / 5)
    const part = demContours(map, { x0: 400, y0: 1000, scale: 1, width: 100, height: 1000 }, 10)
    const levels = part.map((l) => l.level)
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(70)
    expect(Math.max(...levels)).toBeLessThanOrEqual(110)
  })

  it('flat ground has no lines', () => {
    expect(demContours(makeMap(() => 33), wholeMap, 5)).toEqual([])
  })
})
