import { MILS_PER_TURN } from './ballistics'

/**
 * The correction to apply, m:
 * range > 0 means fire farther, lateral > 0 means to the right.
 */
export interface Adjustment {
  range: number
  lateral: number
}

/** An observer report: where the burst landed relative to the target, m. */
export interface SpotReport {
  // > 0 over, < 0 short
  over: number
  // > 0 right of the target, < 0 left of it
  right: number
}

/** The correction is opposite to the miss: over → closer, left → right. */
export function reportToAdjustment(report: SpotReport): Adjustment {
  return { range: -report.over || 0, lateral: -report.right || 0 }
}

/**
 * Converts a correction from the observer frame (the observer to target line)
 * to the gun frame (the gun to target line).
 *
 * A correction is a vector on the ground. It is split along the observer
 * axes and projected onto the gun axes; δ is the angle between the lines:
 *
 *   range   = a·cos δ − b·sin δ
 *   lateral = a·sin δ + b·cos δ
 *
 * where a, b are the range and direction corrections for the observer,
 * δ = observer azimuth − gun azimuth.
 */
export function observerToGun(
  adjustment: Adjustment,
  observerAzimuthMil: number,
  gunAzimuthMil: number
): Adjustment {
  const delta =
    ((observerAzimuthMil - gunAzimuthMil) * 2 * Math.PI) / MILS_PER_TURN
  const cos = Math.cos(delta)
  const sin = Math.sin(delta)
  const { range: a, lateral: b } = adjustment

  // Rounding to a centimetre removes noise like 3e-15 m.
  const clean = (value: number) => Math.round(value * 100) / 100 || 0

  return {
    range: clean(a * cos - b * sin),
    lateral: clean(a * sin + b * cos),
  }
}

export function sumAdjustments(items: readonly Adjustment[]): Adjustment {
  return items.reduce(
    (total, item) => ({
      range: total.range + item.range,
      lateral: total.lateral + item.lateral,
    }),
    { range: 0, lateral: 0 }
  )
}
