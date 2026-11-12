import { heightAt, type Heightmap, type MapPoint } from './heightmap'
import {
  clearance,
  clearanceAlong,
  isBlocked,
  isTight,
  sampleProfile,
} from './terrainClearance'

/**
 * Zones on the map from the terrain.
 *
 *   from: where a gun standing at the point can hit;
 *   to:   where the target standing at the point can be hit from.
 *
 * Rays are built around the centre; on each the ranges from the minimum
 * to the maximum are checked: is there a solution in the table, and does the shell hit terrain
 * on the way (the same check as for a shot at a target). Water is not part of the zone:
 * in "from" it is not fired at, in "to" nobody stands on it.
 */

export type CoverageStatus = 'ok' | 'tight' | 'blocked'

// Zone colours (RGB) for the map and the legend: with transparency on the map
export const COVERAGE_RGB = {
  ok: '70,200,120',
  tight: '255,176,32',
  blocked: '228,72,72',
} as const satisfies Record<CoverageStatus, string>

export interface CoverageSegment {
  // Ranges from the centre, m
  from: number
  to: number
  status: CoverageStatus
}

export interface CoverageRay {
  // The direction from the centre: radians, 0 is north, clockwise
  angle: number
  segments: CoverageSegment[]
}

export interface Coverage {
  center: MapPoint
  mode: 'from' | 'to'
  // The angular width of a ray, radians
  width: number
  rays: CoverageRay[]
}

/** The elevation to a point at this range and height difference (target minus gun). */
export type SolveAt = (distance: number, heightDiff: number) => { elevation: number } | null

export interface CoverageInput {
  map: Heightmap
  center: MapPoint
  mode: 'from' | 'to'
  minRange: number
  maxRange: number
  solve: SolveAt
  // Rays around the circle
  rays?: number
  // Ranges per ray
  steps?: number
}

// A height no greater than this is water, m
const SEA_LEVEL = 0.5

// Rays around the circle (1°) and ranges per ray: the outline follows the terrain
// instead of cutting it with large wedges
const DEFAULT_RAYS = 360
const DEFAULT_STEPS = 120

function worse(a: CoverageStatus, b: CoverageStatus): CoverageStatus {
  const order: CoverageStatus[] = ['ok', 'tight', 'blocked']
  return order.indexOf(a) >= order.indexOf(b) ? a : b
}

export function computeCoverage(input: CoverageInput): Coverage {
  const rays = input.rays ?? DEFAULT_RAYS
  return {
    center: input.center,
    mode: input.mode,
    width: (Math.PI * 2) / rays,
    rays: computeCoverageRays(input, 0, rays),
  }
}

/** How many rays a zone has (for calculating in parts). */
export const coverageRayCount = (input: CoverageInput) => input.rays ?? DEFAULT_RAYS

/**
 * Rays with numbers from start to end (exclusive): a zone can be calculated in
 * parts between frames, so that the interface does not freeze.
 */
export function computeCoverageRays(
  { map, center, mode, minRange, maxRange, solve, rays = DEFAULT_RAYS, steps = DEFAULT_STEPS }: CoverageInput,
  start: number,
  end: number
): CoverageRay[] {
  const width = (Math.PI * 2) / rays
  const result: CoverageRay[] = []
  if (!(maxRange > minRange) || maxRange <= 0) return result

  // The height step along a ray and the step of the checked ranges (a multiple of it)
  const sampleStep = Math.max(10, map.step / 2)
  const wantedStep = Math.max(sampleStep, (maxRange - minRange) / steps)
  const stride = Math.max(1, Math.round(wantedStep / sampleStep))
  const cell = stride * sampleStep

  for (let r = start; r < Math.min(end, rays); r += 1) {
    const angle = r * width
    const dx = Math.sin(angle)
    const dy = Math.cos(angle)

    // Terrain heights from the centre outwards while the ray is inside the map
    const samples: number[] = []
    for (let d = 0; d <= maxRange + cell; d += sampleStep) {
      const h = heightAt(map, { x: center.x + dx * d, y: center.y + dy * d })
      if (h === null) break
      samples.push(h)
    }
    const heights = Float64Array.from(samples)

    const segments: CoverageSegment[] = []
    let open: CoverageSegment | null = null
    const firstIndex = Math.max(1, Math.ceil(minRange / sampleStep / stride) * stride)
    for (let k = firstIndex; k < heights.length; k += stride) {
      const distance = k * sampleStep
      if (distance > maxRange + cell / 2) break

      // "from": the gun is in the centre and the target at the ray end; "to": the other way round
      const first = mode === 'from' ? 0 : k
      const last = mode === 'from' ? k : 0
      const own = heights[first]
      const aim = heights[last]

      let status: CoverageStatus | null = null
      // Water is not in the zone: there is no point firing at it ("from"), you cannot stand in it ("to")
      const land = mode === 'from' ? aim > SEA_LEVEL : own > SEA_LEVEL
      const solved = land ? solve(distance, aim - own) : null
      if (solved !== null) {
        const check = clearanceAlong(heights, first, last, distance, solved.elevation)
        status = isBlocked(check) ? 'blocked' : isTight(check) ? 'tight' : 'ok'
      }

      const from = Math.max(minRange, distance - cell / 2)
      const to = Math.min(maxRange, distance + cell / 2)
      if (status === null) {
        open = null
        continue
      }
      if (open && open.status === status && Math.abs(open.to - from) < 1e-6) {
        open.to = to
      } else {
        open = { from, to, status }
        segments.push(open)
      }
    }

    result.push({ angle, segments })
  }

  return result
}

/** A point at sea level (water): not part of the zones. */
export function isWater(map: Heightmap, point: MapPoint): boolean {
  const h = heightAt(map, point)
  return h !== null && h <= SEA_LEVEL
}

/**
 * Whether the gun reaches a single point (a target in water, which is not in the zone):
 * the status as for a zone, 'out' means no solution in the tables, null means it cannot be calculated.
 */
export function pointStatus(
  map: Heightmap,
  gun: MapPoint,
  target: MapPoint,
  solve: SolveAt
): CoverageStatus | 'out' | null {
  const profile = sampleProfile(map, gun, target)
  if (!profile) return null
  const h = profile.heights
  const solved = solve(profile.distance, h[h.length - 1] - h[0])
  if (!solved) return 'out'
  const check = clearance(profile, solved.elevation)
  return isBlocked(check) ? 'blocked' : isTight(check) ? 'tight' : 'ok'
}

/** The worst status on the range circle: for the "does it reach at all" label. */
export function overallStatus(coverage: Coverage): CoverageStatus | null {
  let status: CoverageStatus | null = null
  for (const ray of coverage.rays) {
    for (const segment of ray.segments) {
      status = status === null ? segment.status : worse(status, segment.status)
    }
  }
  return status
}

export interface Suggestion {
  point: MapPoint
  // The distance to the point, m, from the one it was compared with
  distance: number
}

/**
 * The nearest good spot (a green segment) to the point `near`, and if possible
 * farther from the target: standing close to the target is more dangerous. The "to" mode only.
 * null: there is no good spot.
 */
export function nearestGoodSpot(coverage: Coverage, near: MapPoint): Suggestion | null {
  if (coverage.mode !== 'to') return null
  let best: Suggestion | null = null
  for (const ray of coverage.rays) {
    for (const segment of ray.segments) {
      if (segment.status !== 'ok') continue
      // The middle of a segment and its far edge; the one closest to `near` is taken
      for (const d of [(segment.from + segment.to) / 2]) {
        const point = {
          x: coverage.center.x + Math.sin(ray.angle) * d,
          y: coverage.center.y + Math.cos(ray.angle) * d,
        }
        const distance = Math.hypot(point.x - near.x, point.y - near.y)
        if (best === null || distance < best.distance) best = { point, distance }
      }
    }
  }
  return best
}
