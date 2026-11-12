import { heightAt, type Heightmap, type MapPoint } from './heightmap'

/**
 * Checks whether the shell hits terrain on its way to the target (a hill, a ridge
 * before the target on a low trajectory).
 *
 * The tables in the app were taken without air resistance, and without it the shell
 * flies along a parabola. The elevation angle and the gun and target points define
 * the parabola completely: y(x) = x·tan θ − (x/D)²·(D·tan θ − Δh). The shell
 * velocity is not needed for this. If the game does have air resistance, the arc
 * goes above such a parabola, so the estimate is on the safe side.
 */

export interface TerrainProfile {
  // The distance from the gun to the target on the map, m
  distance: number
  // Terrain heights at an equal step: the first at the gun, the last at the target, m
  heights: number[]
}

export interface Clearance {
  // The smallest clearance of the shell over terrain, m (below zero the shell hits)
  min: number
  // Where it is: the distance from the gun, m; the terrain and shell heights there, m
  at: number
  terrain: number
  shell: number
}

// The barrel above the ground, m
export const MUZZLE_HEIGHT = 1.5
// A clearance below this is "tight": trees and buildings are not in the map terrain, m
export const TIGHT_CLEARANCE = 15
// The shell below terrain by more than this "hits". Less is within the
// height map precision (and the arc with air resistance goes slightly higher): "tight", m
export const BLOCK_TOLERANCE = 3
// At the gun and at the target the map terrain is smoothed: the first and last metres are not checked
const SKIP_START = 30
const SKIP_END = 20

/** Terrain heights along a straight line from the gun to the target at a step no larger than maxStep, m. */
export function sampleProfile(
  map: Heightmap,
  gun: MapPoint,
  target: MapPoint,
  maxStep = 10
): TerrainProfile | null {
  const distance = Math.hypot(target.x - gun.x, target.y - gun.y)
  if (distance < 1) return null
  const step = Math.min(maxStep, Math.max(1, map.step / 2))
  const n = Math.max(2, Math.ceil(distance / step))
  const heights: number[] = []
  for (let i = 0; i <= n; i += 1) {
    const f = i / n
    const h = heightAt(map, { x: gun.x + (target.x - gun.x) * f, y: gun.y + (target.y - gun.y) * f })
    if (h === null) return null
    heights.push(h)
  }
  return { distance, heights }
}

/** The shell height above sea level at the distance x from the gun, m. */
export function shellHeightAt(
  x: number,
  distance: number,
  gunHeight: number,
  targetHeight: number,
  elevationMil: number
): number {
  const tan = Math.tan((elevationMil * Math.PI) / 3200)
  const rise = targetHeight - gunHeight
  const k = x / distance
  return gunHeight + x * tan - k * k * (distance * tan - rise)
}

// A bump: terrain above the "ground at the gun to ground at the target" line by at least this much, m
const BULGE = 2

/**
 * A dangerous spot for a shot with this elevation: where the shell hits
 * terrain, and if nowhere, where it passes lowest over a bump or a
 * ridge. null: there is neither on the way.
 *
 * "Tight" counts only over bumps: in low trajectory fire the shell
 * always goes low before the target, and on flat ground this is not dangerous.
 */
export function clearance(profile: TerrainProfile, elevationMil: number): Clearance | null {
  return clearanceAlong(profile.heights, 0, profile.heights.length - 1, profile.distance, elevationMil)
}

/**
 * The same over a part of the height array without copying: from the index first (the gun)
 * to last (the target), in either direction. For the zones on the map, where there are thousands of profiles.
 */
export function clearanceAlong(
  heights: ArrayLike<number>,
  first: number,
  last: number,
  distance: number,
  elevationMil: number
): Clearance | null {
  const n = Math.abs(last - first)
  if (n < 2) return null
  const dir = last > first ? 1 : -1
  const own = heights[first]
  const gunHeight = own + MUZZLE_HEIGHT
  const targetHeight = heights[last]
  // A parabola as in shellHeightAt, but the tangent is computed once per profile: the zones
  // on the map check millions of points
  const tan = Math.tan((elevationMil * Math.PI) / 3200)
  const drop = distance * tan - (targetHeight - gunHeight)
  let hit: Clearance | null = null
  let bump: Clearance | null = null
  for (let i = 1; i < n; i += 1) {
    const x = (i / n) * distance
    if (x < SKIP_START || x > distance - SKIP_END) continue
    const ground = heights[first + dir * i]
    const k = i / n
    const shell = gunHeight + x * tan - k * k * drop
    const margin = shell - ground
    if (margin < -BLOCK_TOLERANCE) {
      if (hit === null || margin < hit.min) hit = { min: margin, at: x, terrain: ground, shell }
      continue
    }
    const chord = own + ((targetHeight - own) * i) / n
    const close = margin < 0 || ground > chord + BULGE
    if (close && (bump === null || margin < bump.min)) bump = { min: margin, at: x, terrain: ground, shell }
  }
  return hit ?? bump
}

export const isBlocked = (c: Clearance | null) => c !== null && c.min < -BLOCK_TOLERANCE
export const isTight = (c: Clearance | null) =>
  c !== null && c.min >= -BLOCK_TOLERANCE && c.min < TIGHT_CLEARANCE
