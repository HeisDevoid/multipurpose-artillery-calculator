import { MILS_PER_TURN } from './ballistics'

export interface GridPoint {
  // Metres from the origin of the map grid: east, north
  x: number
  y: number
  // The size of the square the coordinate sets, m (precision)
  precision: number
}

/**
 * Parsing an Arma grid coordinate: 6, 8 or 10 digits
 * (100 m, 10 m, 1 m). Spaces and other characters are ignored.
 * The square centre is taken, so that the error does not exceed half a cell.
 */
export function parseGrid(value: string): GridPoint | null {
  const digits = value.replace(/\D/g, '')
  if (![6, 8, 10].includes(digits.length)) return null

  const half = digits.length / 2
  const precision = 10 ** (5 - half)

  return {
    x: Number(digits.slice(0, half)) * precision + precision / 2,
    y: Number(digits.slice(half)) * precision + precision / 2,
    precision,
  }
}

/** The distance (m) and the azimuth (mils, 0 = north, clockwise) from a to b. */
export function gridVector(a: GridPoint, b: GridPoint) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const angle = Math.atan2(dx, dy)

  return {
    distance: Math.hypot(dx, dy),
    azimuthMil:
      ((((angle * MILS_PER_TURN) / (2 * Math.PI)) % MILS_PER_TURN) +
        MILS_PER_TURN) %
      MILS_PER_TURN,
    // The worse precision of the two coordinates
    precision: Math.max(a.precision, b.precision),
  }
}
