import { describe, expect, it } from 'vitest'

import { computeCoverage, isWater, nearestGoodSpot, overallStatus, pointStatus, type SolveAt } from './coverage'
import type { Heightmap } from './heightmap'

/** A map of size×size points with a step of step; the height is a function of the coordinates. */
function makeMap(height: (x: number, y: number) => number, size = 101, step = 50): Heightmap {
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) heights[j * size + i] = height(i * step, j * step)
  }
  return { world: 'test', worldSize: (size - 1) * step, step, size, heights }
}

// Low trajectory fire along a parabola: the elevation is picked for the range
const flat: SolveAt = (distance) => ({
  elevation: Math.min(400, (distance / 8000) * 800),
})
const never: SolveAt = () => null

describe('computeCoverage', () => {
  it('on flat ground everything around the gun is clear', () => {
    const map = makeMap(() => 100)
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 36,
    })
    expect(cov.rays).toHaveLength(36)
    expect(overallStatus(cov)).toBe('ok')
    // One continuous segment from the minimum to the maximum range
    for (const ray of cov.rays) {
      expect(ray.segments).toHaveLength(1)
      expect(ray.segments[0].from).toBeGreaterThanOrEqual(100)
      expect(ray.segments[0].to).toBeLessThanOrEqual(1500)
    }
  })

  it('no segments without a solution in the table', () => {
    const map = makeMap(() => 100)
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 100,
      maxRange: 1500,
      solve: never,
      rays: 12,
    })
    expect(cov.rays.every((ray) => ray.segments.length === 0)).toBe(true)
    expect(overallStatus(cov)).toBeNull()
  })

  it('a mountain in the east blocks the targets behind it, the west is clear', () => {
    // A 300 m ridge at x = 3000..3200, the gun at x = 2500
    const map = makeMap((x) => (x >= 3000 && x <= 3200 ? 400 : 100))
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 4,
    })
    const east = cov.rays.find((ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9)!
    const west = cov.rays.find((ray) => Math.abs(ray.angle - (3 * Math.PI) / 2) < 1e-9)!
    expect(east.segments.some((s) => s.status === 'blocked')).toBe(true)
    expect(west.segments.every((s) => s.status === 'ok')).toBe(true)
  })

  it('the "to" mode: standing behind the ridge is not possible, in front of it is', () => {
    // The target is west of the ridge; the ridge in the east blocks the positions behind it
    const map = makeMap((x) => (x >= 3000 && x <= 3200 ? 400 : 100))
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'to',
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 4,
    })
    const east = cov.rays.find((ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9)!
    expect(east.segments.some((s) => s.status === 'blocked')).toBe(true)
    const north = cov.rays.find((ray) => ray.angle === 0)!
    expect(north.segments.every((s) => s.status === 'ok')).toBe(true)
  })

  it('water is not in the zone: in "to" you cannot stand in it, in "from" it is not fired at', () => {
    // The sea (height 0) east of x = 3000
    const map = makeMap((x) => (x >= 3000 ? 0 : 100))
    const input = {
      map,
      center: { x: 2500, y: 2500 },
      minRange: 100,
      maxRange: 1500,
      solve: flat,
      rays: 4,
    }
    const eastTo = computeCoverage({ ...input, mode: 'to' }).rays.find(
      (ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9
    )!
    expect(Math.max(...eastTo.segments.map((s) => s.to))).toBeLessThanOrEqual(600)
    const eastFrom = computeCoverage({ ...input, mode: 'from' }).rays.find(
      (ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9
    )!
    expect(Math.max(...eastFrom.segments.map((s) => s.to))).toBeLessThanOrEqual(600)
    // Land to the west: the zone goes to the end of the range
    const westFrom = computeCoverage({ ...input, mode: 'from' }).rays.find(
      (ray) => Math.abs(ray.angle - (3 * Math.PI) / 2) < 1e-9
    )!
    expect(Math.max(...westFrom.segments.map((s) => s.to))).toBeGreaterThan(1000)
  })

  it('a target in water: whether the gun reaches it, separately from the zone', () => {
    const map = makeMap((x) => (x >= 3000 ? 0 : 100))
    const gun = { x: 2500, y: 2500 }
    expect(isWater(map, { x: 3500, y: 2500 })).toBe(true)
    expect(isWater(map, gun)).toBe(false)
    // At a cliff to the sea the shell may pass tight: what matters is that the status is calculated
    expect(['ok', 'tight', 'blocked']).toContain(pointStatus(map, gun, { x: 3500, y: 2500 }, flat))
    expect(pointStatus(map, gun, { x: 3500, y: 2500 }, () => null)).toBe('out')
  })

  it('a ray stops at the map edge', () => {
    const map = makeMap(() => 100, 21, 50) // 1000 m
    const cov = computeCoverage({
      map,
      center: { x: 900, y: 500 },
      mode: 'from',
      minRange: 50,
      maxRange: 2000,
      solve: flat,
      rays: 4,
    })
    const east = cov.rays.find((ray) => Math.abs(ray.angle - Math.PI / 2) < 1e-9)!
    expect(east.segments[east.segments.length - 1].to).toBeLessThanOrEqual(150)
  })

  it('an empty range span gives an empty result', () => {
    const map = makeMap(() => 100)
    const cov = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 500,
      maxRange: 500,
      solve: flat,
    })
    expect(cov.rays).toEqual([])
  })
})

describe('nearestGoodSpot', () => {
  const map = makeMap(() => 100)
  const cov = computeCoverage({
    map,
    center: { x: 2500, y: 2500 },
    mode: 'to',
    minRange: 200,
    maxRange: 1200,
    solve: flat,
    rays: 36,
  })

  it('takes the green spot closest to the gun', () => {
    // The gun is 1000 m east of the target: the nearest spot lies on the same side
    const spot = nearestGoodSpot(cov, { x: 3500, y: 2500 })
    expect(spot).not.toBeNull()
    expect(spot!.point.x).toBeGreaterThan(2500)
    expect(Math.abs(spot!.point.y - 2500)).toBeLessThan(200)
  })

  it('there is no hint for the "from" mode', () => {
    const from = computeCoverage({
      map,
      center: { x: 2500, y: 2500 },
      mode: 'from',
      minRange: 200,
      maxRange: 1200,
      solve: flat,
      rays: 12,
    })
    expect(nearestGoodSpot(from, { x: 0, y: 0 })).toBeNull()
  })
})
