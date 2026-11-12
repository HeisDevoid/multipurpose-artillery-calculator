import type { ArtilleryCategory } from '../types/gameModel'
import type { MapPoint } from './heightmap'

/**
 * Line fire (a tree line, a road, a trench): the line is drawn on the map,
 * and the app places aim points along it so that the hit zones
 * of neighbouring bursts cover the whole length.
 */

export interface FireDensity {
  id: 'dense' | 'medium' | 'sparse' | 'very-sparse'
  // The hit radius of one burst, m: aim points no farther apart than two radii
  radius: number
}

// Fire density: the denser, the more often the aim points go along the line
export const FIRE_DENSITIES: readonly FireDensity[] = [
  { id: 'dense', radius: 15 },
  { id: 'medium', radius: 50 },
  { id: 'sparse', radius: 75 },
  { id: 'very-sparse', radius: 100 },
]

/**
 * The density for a weapon by its burst radius (from game experience): a mortar ±15 m,
 * artillery ±50 m, an MLRS ±75 m.
 */
export function recommendedDensity(category: ArtilleryCategory): FireDensity['id'] {
  switch (category) {
    case 'towed':
    case 'spg':
      return 'medium'
    case 'mlrs':
      return 'sparse'
    default:
      return 'dense'
  }
}

/** The polyline length, m. */
export function polylineLength(points: readonly MapPoint[]): number {
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  return total
}

/** A point on the polyline at the distance d from the start (past the end: the end). */
export function pointAlong(points: readonly MapPoint[], d: number): MapPoint {
  let rest = Math.max(0, d)
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const segment = Math.hypot(b.x - a.x, b.y - a.y)
    if (rest <= segment && segment > 0) {
      const t = rest / segment
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    rest -= segment
  }
  const last = points[points.length - 1]
  return { x: last.x, y: last.y }
}

/**
 * Aim points along the line. The line is split into n equal parts
 * no wider than the hit diameter, and the aim is at the middle of each:
 * this way the line ends are in the hit zone too.
 */
export function aimPoints(points: readonly MapPoint[], radius: number): MapPoint[] {
  if (points.length === 0 || radius <= 0) return []
  const length = polylineLength(points)
  const n = Math.max(1, Math.ceil(length / (2 * radius)))
  const step = length / n
  return Array.from({ length: n }, (_, i) => pointAlong(points, (i + 0.5) * step))
}
