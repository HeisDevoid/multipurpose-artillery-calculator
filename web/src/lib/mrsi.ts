import type { ArtilleryMode } from '../types/artillery'

/** A way to fire at the target: the mode, the charge and the solution for it. */
export interface MrsiOption {
  mode: ArtilleryMode
  charge: number
  elevation: number
  tof: number
}

export interface MrsiShot extends MrsiOption {
  // When to fire, s from the first shot
  fireAt: number
}

/**
 * The simultaneous impact chosen in the calculator: the plan for the overlay and Link.
 * startedAt is when the first shot started (this device's clock), null means
 * not started yet. Only the plan goes over Link: everyone starts on their own, on
 * the "shot" signal.
 */
export interface MrsiRun {
  shots: MrsiShot[]
  startedAt: number | null
}

/** How fire on the current charge passes over terrain: tight or blocked. */
export type TerrainStatus = 'tight' | 'blocked' | null

/**
 * The plan of a simultaneous impact (MRSI) with one gun: first the shot with
 * the longest flight, the others with a delay so that all
 * shells land at the same time.
 *
 * minGap is the minimum interval between shots (reload), s.
 * Variants that cannot be loaded in time are dropped: of those close in
 * time the one earlier in the list (with a longer flight) stays.
 */
export function planMrsi(
  options: readonly MrsiOption[],
  minGap: number
): MrsiShot[] {
  const sorted = [...options].sort((a, b) => b.tof - a.tof)
  if (sorted.length === 0) return []

  const longest = sorted[0].tof
  const plan: MrsiShot[] = []

  for (const option of sorted) {
    const fireAt = longest - option.tof
    const last = plan[plan.length - 1]
    if (last && fireAt - last.fireAt < minGap) continue
    plan.push({ ...option, fireAt })
  }

  return plan
}
