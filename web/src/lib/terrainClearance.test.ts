import { describe, expect, it } from 'vitest'

import type { Heightmap } from './heightmap'
import { clearance, isBlocked, isTight, sampleProfile, shellHeightAt } from './terrainClearance'

// A 10×10 km map with a 50 m step; the height is a function of x (along the line of fire)
function terrain(height: (x: number) => number): Heightmap {
  const step = 50
  const size = 201
  const heights = new Float32Array(size * size)
  for (let j = 0; j < size; j += 1) {
    for (let i = 0; i < size; i += 1) heights[j * size + i] = height(i * step)
  }
  return { world: 'test', worldSize: (size - 1) * step, step, size, heights }
}

const gun = { x: 1000, y: 5000 }
const target = { x: 7000, y: 5000 }

describe('terrain profile', () => {
  it('goes from the gun to the target in equal steps', () => {
    const profile = sampleProfile(terrain((x) => x / 100), gun, target)!
    expect(profile.distance).toBe(6000)
    expect(profile.heights[0]).toBeCloseTo(10)
    expect(profile.heights[profile.heights.length - 1]).toBeCloseTo(70)
  })

  it('there is no profile beyond the map edge', () => {
    expect(sampleProfile(terrain(() => 0), gun, { x: 20000, y: 5000 })).toBeNull()
  })
})

describe('shell arc', () => {
  it('starts at the gun and arrives exactly at the target', () => {
    expect(shellHeightAt(0, 6000, 100, 40, 300)).toBeCloseTo(100)
    expect(shellHeightAt(6000, 6000, 100, 40, 300)).toBeCloseTo(40)
  })

  it('on flat ground the top is in the middle: D·tan θ / 4', () => {
    const apex = shellHeightAt(3000, 6000, 0, 0, 800)
    expect(apex).toBeCloseTo((6000 * Math.tan(Math.PI / 4)) / 4)
  })
})

describe('clearance over terrain', () => {
  // A 150 m ridge halfway
  const ridge = terrain((x) => (Math.abs(x - 4000) < 150 ? 150 : 0))
  const profile = sampleProfile(ridge, gun, target)!

  it('the low arc hits the ridge, the high one passes', () => {
    // 60 mils ≈ 3.4°: halfway the shell is at about 88 m
    const low = clearance(profile, 60)
    expect(isBlocked(low)).toBe(true)
    // The ridge is 3 km from the gun
    expect(low!.at).toBeGreaterThan(2800)
    expect(low!.at).toBeLessThan(3200)
    expect(isBlocked(clearance(profile, 1200))).toBe(false)
  })

  it('nothing gets in the way on flat ground, even low at the target', () => {
    const flat = sampleProfile(terrain(() => 20), gun, target)!
    expect(clearance(flat, 60)).toBeNull()
    expect(clearance(flat, 20)).toBeNull()
  })

  it('a target on an upward slope: the rise before the target does not count as a bump', () => {
    const slope = sampleProfile(terrain((x) => x / 20), gun, target)!
    expect(isBlocked(clearance(slope, 120))).toBe(false)
  })

  it('touching by a couple of metres is "tight", not "hits": this is within the map precision', () => {
    const grazing = clearance(profile, 100)!
    expect(grazing.min).toBeLessThan(0)
    expect(isBlocked(grazing)).toBe(false)
    expect(isTight(grazing)).toBe(true)
  })

  it('a low pass over a ridge is "tight"', () => {
    // The angle is picked so that ~5 m remain over the ridge
    const near = clearance(profile, 105)!
    expect(near.min).toBeGreaterThan(0)
    expect(isTight(near)).toBe(true)
  })
})
