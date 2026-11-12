import type {
  ArtilleryMode,
  BallisticProfile,
  BallisticRow,
} from '../types/artillery'

/** The weather columns of the table for one range. */
export interface WeatherCoefficients {
  azimuthPerCrosswind: number | null
  rangePerHeadwind: number | null
  rangePerTailwind: number | null
  rangePerTempDec: number | null
  rangePerTempInc: number | null
  rangePerDensityDec: number | null
  rangePerDensityInc: number | null
}

/**
 * Values interpolated from the game table for a given range.
 * null: the game table has a dash "-" in this interval.
 */
export interface TableValues {
  elevation: number
  dElevPer100m: number | null
  dTofPer100m: number | null
  tof: number
  // null: the table has no weather columns
  weather: WeatherCoefficients | null
}

/**
 * Weather conditions relative to the line of fire.
 * Zeros / null mean standard conditions (no correction).
 */
export interface Weather {
  // m/s: > 0 headwind, < 0 tailwind
  headwind: number
  // m/s: > 0 blows from the right (drifts left), < 0 blows from the left
  crosswind: number
  // °C; null: the standard 15 °C
  temperature: number | null
  // % of the standard density; null: 100%
  density: number | null
}

export const STANDARD_TEMPERATURE = 15
export const STANDARD_DENSITY = 100
export const STANDARD_PRESSURE = 1013.25

export const NO_WEATHER: Weather = {
  headwind: 0,
  crosswind: 0,
  temperature: null,
  density: null,
}

export interface WeatherCorrection {
  // Range corrections, m (added to the table range)
  wind: number
  temperature: number
  density: number
  total: number
  // Azimuth correction, mils: > 0 turn right, < 0 left
  azimuth: number
  // A correction is needed but the table has no data (a dash or no columns)
  missing: boolean
}

export interface FiringSolution {
  // Elevation with the height difference, mils
  elevation: number
  // Time of flight with the height difference, s
  tof: number

  // The range the table row was taken for
  // (distance + manual adjustment + weather correction)
  lookupRange: number

  // Values for flat ground (straight from the table)
  baseElevation: number
  baseTof: number

  // Corrections already included in elevation and tof
  elevationCorrection: number
  tofCorrection: number

  // A height correction is needed, but the table has a dash at this range
  heightCorrectionMissing: boolean

  weather: WeatherCorrection
}

export interface ChargeResult {
  charge: number
  minRange: number
  maxRange: number
  // null: the range is outside the table of this charge
  solution: FiringSolution | null
  // Range error per 1 mil of elevation error, m (smaller is more precise)
  metersPerMil: number | null
  // The solution is in the last interval of the table (at the charge's
  // maximum range): corrections are less reliable here
  nearEdge: boolean
  // There is a gap between neighbouring table rows (wider than the normal step):
  // interpolation is less precise
  wideGap: boolean
}

/** How to choose the default charge. */
export type ChargePreference = 'best' | 'lowest' | 'fastest' | 'precise'

// A height correction larger than this (mils) counts as a linear
// estimate with lower precision.
const LARGE_CORRECTION_MIL = 50

export const MILS_PER_TURN = 6400

export function degToMil(deg: number): number {
  return (deg * MILS_PER_TURN) / 360
}

export function milToDeg(mil: number): number {
  return (mil * 360) / MILS_PER_TURN
}

/**
 * The lateral correction in mils: shift the burst by meters
 * (> 0 right, < 0 left) at the distance distance.
 */
export function lateralCorrectionMil(meters: number, distance: number): number {
  if (distance <= 0) return 0
  return (Math.atan2(meters, distance) * MILS_PER_TURN) / (2 * Math.PI)
}

/** Brings an angle into the range [0, full). */
export function normalizeAngle(value: number, full: number): number {
  const result = value % full
  return result < 0 ? result + full : result
}

/**
 * Splits the wind into head and cross components.
 *
 * windFromDeg: where the wind blows from (the meteorological direction), °.
 * azimuthDeg: the azimuth to the target, °.
 */
export function windComponents(
  speed: number,
  windFromDeg: number,
  azimuthDeg: number
): { headwind: number; crosswind: number } {
  const relative = ((windFromDeg - azimuthDeg) * Math.PI) / 180
  // Remove noise like 3e-16 for wind blowing exactly across.
  const clean = (value: number) => Math.round(value * 1e6) / 1e6 || 0
  return {
    headwind: clean(speed * Math.cos(relative)),
    crosswind: clean(speed * Math.sin(relative)),
  }
}

/**
 * Air density in % of the standard (15 °C, 1013.25 hPa),
 * from the ideal gas law without humidity.
 */
export function airDensityPercent(
  temperatureC: number,
  pressureHpa: number
): number {
  const kelvin = temperatureC + 273.15
  return (
    (pressureHpa / STANDARD_PRESSURE) *
    ((STANDARD_TEMPERATURE + 273.15) / kelvin) *
    100
  )
}

export function tableRange(rows: readonly BallisticRow[]) {
  return {
    min: rows[0][0],
    max: rows[rows.length - 1][0],
  }
}

export function profileHasWeather(profile: BallisticProfile): boolean {
  return Object.values(profile.modes).some(
    (tables) =>
      tables !== undefined &&
      Object.values(tables).some((rows) => rows[0]?.length === 12)
  )
}

/**
 * Linear interpolation between two neighbouring table rows.
 * Returns null if the range is outside the table:
 * there is no extrapolation, so that no data is made up.
 * If one of the neighbouring values is a dash, the result is null too.
 */
export function interpolateRow(
  rows: readonly BallisticRow[],
  range: number
): TableValues | null {
  if (rows.length === 0 || !Number.isFinite(range)) return null

  const { min, max } = tableRange(rows)
  if (range < min || range > max) return null

  let lo = 0
  let hi = rows.length - 1

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (rows[mid][0] <= range) lo = mid
    else hi = mid
  }

  const a = rows[lo]
  const b = rows[hi]
  const t = b[0] === a[0] ? 0 : (range - a[0]) / (b[0] - a[0])

  function pick(i: number): number | null {
    const x = a[i] ?? null
    const y = b[i] ?? null
    if (t === 0) return x
    if (t === 1) return y
    if (x === null || y === null) return null
    return x + (y - x) * t
  }

  const weather: WeatherCoefficients | null =
    a.length === 12 && b.length === 12
      ? {
          azimuthPerCrosswind: pick(5),
          rangePerHeadwind: pick(6),
          rangePerTailwind: pick(7),
          rangePerTempDec: pick(8),
          rangePerTempInc: pick(9),
          rangePerDensityDec: pick(10),
          rangePerDensityInc: pick(11),
        }
      : null

  return {
    elevation: pick(1) as number,
    dElevPer100m: pick(2),
    dTofPer100m: pick(3),
    tof: pick(4) as number,
    weather,
  }
}

/**
 * A correction for one factor: the deviation from the standard is multiplied by
 * the "decrease" or "increase" column, depending on the sign.
 * The game columns already hold the sign of the correction, so the absolute
 * deviation is taken.
 */
function factorCorrection(
  deviation: number,
  perDecrease: number | null,
  perIncrease: number | null
): { value: number; missing: boolean } {
  if (deviation === 0) return { value: 0, missing: false }
  const coefficient = deviation < 0 ? perDecrease : perIncrease
  if (coefficient === null) return { value: 0, missing: true }
  return { value: Math.abs(deviation) * coefficient, missing: false }
}

/**
 * Weather corrections from the table columns.
 *
 * The ACE3 table rule: the values of the "RANGE CORRECTION FOR" columns
 * are metres to add to the range before choosing the
 * elevation (headwind → a positive correction, tailwind →
 * a negative one). The azimuth correction is given per 1 m/s of crosswind;
 * the shell drifts with the wind, so the deflection is against the wind.
 */
export function weatherCorrection(
  coefficients: WeatherCoefficients | null,
  weather: Weather
): WeatherCorrection {
  const temperatureDeviation =
    weather.temperature === null
      ? 0
      : weather.temperature - STANDARD_TEMPERATURE
  const densityDeviation =
    weather.density === null ? 0 : weather.density - STANDARD_DENSITY

  const needed =
    weather.headwind !== 0 ||
    weather.crosswind !== 0 ||
    temperatureDeviation !== 0 ||
    densityDeviation !== 0

  if (coefficients === null) {
    return {
      wind: 0,
      temperature: 0,
      density: 0,
      total: 0,
      azimuth: 0,
      missing: needed,
    }
  }

  // Headwind is a "decrease" (the HEAD column), tailwind is an
  // "increase" (the TAIL column, negative values).
  const wind = factorCorrection(
    -weather.headwind,
    coefficients.rangePerHeadwind,
    coefficients.rangePerTailwind
  )
  const temperature = factorCorrection(
    temperatureDeviation,
    coefficients.rangePerTempDec,
    coefficients.rangePerTempInc
  )
  const density = factorCorrection(
    densityDeviation,
    coefficients.rangePerDensityDec,
    coefficients.rangePerDensityInc
  )

  let azimuth = 0
  let azimuthMissing = false
  if (weather.crosswind !== 0) {
    if (coefficients.azimuthPerCrosswind === null) azimuthMissing = true
    // Wind from the right (crosswind > 0) drifts left → turn right.
    else azimuth = weather.crosswind * coefficients.azimuthPerCrosswind
  }

  return {
    wind: wind.value,
    temperature: temperature.value,
    density: density.value,
    total: wind.value + temperature.value + density.value,
    azimuth,
    missing:
      wind.missing ||
      temperature.missing ||
      density.missing ||
      azimuthMissing,
  }
}

/**
 * The settings for one range and one charge.
 *
 * range: the distance to the target with the manual adjustment, m.
 * heightDiff = target height − own position height, m.
 *
 * 1. The weather coefficients are taken from the row for range, and the weather
 *    correction is added to the range.
 * 2. The elevation and time of flight are taken for the resulting range.
 * 3. The "D ELEV / TIME OF FLIGHT PER 100 M DR" columns are the change of
 *    elevation and time of flight for every 100 m of height difference.
 *    The rule from the ACE3 wiki: if you are above the target, add; if below,
 *    subtract. For a target above the position (heightDiff > 0):
 *
 *      elevation = table − (ΔH / 100) · dElev
 *      tof       = table − (ΔH / 100) · dTof
 */
export function solve(
  rows: readonly BallisticRow[],
  range: number,
  heightDiff = 0,
  weather: Weather = NO_WEATHER
): FiringSolution | null {
  const atTarget = interpolateRow(rows, range)
  if (atTarget === null) return null

  const correction = weatherCorrection(atTarget.weather, weather)
  const lookupRange = range + correction.total

  const values =
    correction.total === 0 ? atTarget : interpolateRow(rows, lookupRange)
  if (values === null) return null

  const k = heightDiff / 100
  const needsCorrection = heightDiff !== 0

  const elevationCorrection =
    values.dElevPer100m === null ? 0 : -k * values.dElevPer100m
  const tofCorrection =
    values.dTofPer100m === null ? 0 : -k * values.dTofPer100m

  return {
    elevation: values.elevation + elevationCorrection,
    tof: Math.max(0, values.tof + tofCorrection),
    lookupRange,
    baseElevation: values.elevation,
    baseTof: values.tof,
    elevationCorrection,
    tofCorrection,
    heightCorrectionMissing:
      needsCorrection &&
      (values.dElevPer100m === null || values.dTofPer100m === null),
    weather: correction,
  }
}

/**
 * Sensitivity to an elevation error: how many metres of range
 * 1 mil gives along the table slope at this point. On a row the
 * next interval is taken (the previous one at the last row).
 */
export function metersPerMil(
  rows: readonly BallisticRow[],
  range: number
): number | null {
  if (rows.length < 2) return null
  const { min, max } = tableRange(rows)
  if (!Number.isFinite(range) || range < min || range > max) return null

  let i = rows.findIndex((row) => row[0] > range)
  if (i === -1) i = rows.length - 1
  if (i === 0) i = 1

  const a = rows[i - 1]
  const b = rows[i]
  const deltaElevation = Math.abs(b[1] - a[1])
  return deltaElevation === 0 ? null : (b[0] - a[0]) / deltaElevation
}

/** The range fell into the last interval of the table. */
export function isNearTableEdge(
  rows: readonly BallisticRow[],
  range: number
): boolean {
  if (rows.length < 3) return false
  return range > rows[rows.length - 2][0]
}

/**
 * The range lies between rows spaced wider than the normal table
 * step (the game skips some ranges, especially in the LOW mode).
 * On a row itself there is no interpolation, so a gap does not matter.
 */
export function isWideGap(
  rows: readonly BallisticRow[],
  range: number
): boolean {
  if (rows.length < 3) return false

  const steps = rows
    .slice(1)
    .map((row, i) => row[0] - rows[i][0])
    .sort((a, b) => a - b)
  const typical = steps[Math.floor(steps.length / 2)]

  const i = rows.findIndex((row) => row[0] >= range)
  if (i <= 0 || rows[i][0] === range) return false
  return rows[i][0] - rows[i - 1][0] > 1.5 * typical
}

/**
 * A balanced score of the variants (smaller is better): time of flight and the range
 * error per 1 mil, each as a fraction of the best among the variants. This way
 * "best" is neither the fastest nor the most precise but a balance.
 */
export function balancedScores(
  items: readonly { tof: number; metersPerMil: number | null }[]
): number[] {
  const minTof = Math.min(...items.map((i) => i.tof))
  const mpms = items.flatMap((i) =>
    i.metersPerMil !== null && i.metersPerMil > 0 ? [i.metersPerMil] : []
  )
  const minMpm = mpms.length > 0 ? Math.min(...mpms) : null
  return items.map(
    (i) =>
      (minTof > 0 ? i.tof / minTof : 1) +
      (minMpm !== null && i.metersPerMil !== null && i.metersPerMil > 0
        ? i.metersPerMil / minMpm
        : minMpm !== null
          ? 10
          : 1)
  )
}

/**
 * The default charge among the suitable ones:
 *   best:    a balance of time of flight and precision;
 *   lowest:  the lowest number;
 *   fastest: the shortest time of flight;
 *   precise: the smallest range error per 1 mil.
 * On a tie the lower charge wins. Charges at the table edge are not chosen
 * if there are others: "precision" there is illusory, the corrections are unreliable.
 */
export function pickCharge(
  results: readonly ChargeResult[],
  preference: ChargePreference
): ChargeResult | undefined {
  const usable = results.filter((r) => r.solution !== null)
  if (preference === 'lowest' || usable.length < 2) return usable[0]

  const safe = usable.filter((r) => !r.nearEdge)
  const pool = safe.length > 0 ? safe : usable

  if (preference === 'best') {
    const scores = balancedScores(
      pool.map((r) => ({ tof: r.solution!.tof, metersPerMil: r.metersPerMil }))
    )
    let bestIndex = 0
    for (let i = 1; i < pool.length; i += 1) {
      if (scores[i] < scores[bestIndex]) bestIndex = i
    }
    return pool[bestIndex]
  }

  const score = (r: ChargeResult) =>
    preference === 'fastest'
      ? r.solution!.tof
      : (r.metersPerMil ?? Number.POSITIVE_INFINITY)

  return pool.reduce((best, r) => (score(r) < score(best) ? r : best))
}


export function isLargeCorrection(solution: FiringSolution): boolean {
  return Math.abs(solution.elevationCorrection) > LARGE_CORRECTION_MIL
}

/**
 * The calculation for all charges of a profile in the selected mode.
 * Charges are returned in ascending order.
 */
export function solveAllCharges(
  profile: BallisticProfile,
  mode: ArtilleryMode,
  allowedCharges: readonly number[] | undefined,
  range: number,
  heightDiff: number,
  weather: Weather = NO_WEATHER
): ChargeResult[] {
  const tables = profile.modes[mode]
  if (!tables) return []

  return Object.entries(tables)
    .map(([key, rows]) => ({ charge: Number(key), rows }))
    .filter(
      ({ charge }) =>
        allowedCharges === undefined || allowedCharges.includes(charge)
    )
    .sort((a, b) => a.charge - b.charge)
    .map(({ charge, rows }) => {
      const { min, max } = tableRange(rows)
      const solution = solve(rows, range, heightDiff, weather)
      return {
        charge,
        minRange: min,
        maxRange: max,
        solution,
        metersPerMil: solution
          ? metersPerMil(rows, solution.lookupRange)
          : null,
        nearEdge: solution
          ? isNearTableEdge(rows, solution.lookupRange)
          : false,
        wideGap: solution ? isWideGap(rows, solution.lookupRange) : false,
      }
    })
}

/** The common range span of all charges. */
export function overallRange(results: readonly ChargeResult[]) {
  if (results.length === 0) return null
  return {
    min: Math.min(...results.map((r) => r.minRange)),
    max: Math.max(...results.map((r) => r.maxRange)),
  }
}

/**
 * The best way to fire among all trajectories: for every trajectory the
 * best charge by priority is taken, then they are compared with each other.
 * lowest: the lower charge number (on a tie the first trajectory),
 * fastest: the shorter time of flight, precise: the smaller error per 1 mil.
 * Charges at the table edge lose to any others.
 */
export function pickBest<G extends { results: readonly ChargeResult[] }>(
  groups: readonly G[],
  preference: ChargePreference
): { group: G; result: ChargeResult } | undefined {
  const candidates = groups.flatMap((group) => {
    const result = pickCharge(group.results, preference)
    return result ? [{ group, result }] : []
  })
  if (candidates.length === 0) return undefined

  const safe = candidates.filter((c) => !c.result.nearEdge)
  const pool = safe.length > 0 ? safe : candidates

  if (preference === 'best') {
    const scores = balancedScores(
      pool.map((c) => ({
        tof: c.result.solution!.tof,
        metersPerMil: c.result.metersPerMil,
      }))
    )
    let bestIndex = 0
    for (let i = 1; i < pool.length; i += 1) {
      if (scores[i] < scores[bestIndex]) bestIndex = i
    }
    return pool[bestIndex]
  }

  const score = (c: (typeof pool)[number]) =>
    preference === 'lowest'
      ? c.result.charge
      : preference === 'fastest'
        ? c.result.solution!.tof
        : (c.result.metersPerMil ?? Number.POSITIVE_INFINITY)

  return pool.reduce((best, c) => (score(c) < score(best) ? c : best))
}
