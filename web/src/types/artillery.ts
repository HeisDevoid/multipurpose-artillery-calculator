
export type ArtilleryMode = 'HIGH' | 'LOW'

export type DataStatus =
  | 'pending'
  | 'in-progress'
  | 'verified'

// null means a dash "-" in the game table (no value).
// One row of the game table:
// [range m, elevation mils, d-elevation per 100 m
//  of height difference mils, d-time of flight per 100 m of height difference s,
//  time of flight s]
export type BaseBallisticRow = readonly [
  range: number,
  elevation: number,
  dElevPer100m: number | null,
  dTofPer100m: number | null,
  tof: number,
]

// A row with weather columns (ACE3 advanced corrections):
// the azimuth correction per 1 m/s of crosswind (mils) and the range
// corrections (m) per 1 m/s of head / tail wind, per 1 °C
// of temperature decrease / increase (from 15 °C) and per 1% of air density
// decrease / increase. The range corrections are added
// to the range the table row is taken for.
export type WeatherBallisticRow = readonly [
  ...BaseBallisticRow,
  azimuthPerCrosswind: number | null,
  rangePerHeadwind: number | null,
  rangePerTailwind: number | null,
  rangePerTempDec: number | null,
  rangePerTempInc: number | null,
  rangePerDensityDec: number | null,
  rangePerDensityInc: number | null,
]

export type BallisticRow = BaseBallisticRow | WeatherBallisticRow

// Charge (a string in the JSON) -> table rows
export type ChargeTables = Record<string, BallisticRow[]>

export interface BallisticProfile {
  columns: string[]
  units: Record<string, string>
  notes?: string
  // Mode (HIGH / LOW) -> tables by charge
  modes: Partial<Record<ArtilleryMode, ChargeTables>>
}

export interface Ammunition {
  id: string
  designation: string
  type: string
  description: string
  verified: boolean

  // The charge numbers available for the ammunition
  charges?: number[]
  // The profile key from ArtilleryReference.profiles
  profile?: string
  // The profile for a game with advanced ballistics on (air resistance):
  // the game table is completely different then. No key: no tables yet.
  advancedProfile?: string
}

export interface ArtilleryReference {
  schemaVersion: number
  id: string
  name: string
  modification: string

  availableModes: ArtilleryMode[]

  source: {
    name: string
    status: DataStatus
    // export: the tables were exported from the game by a script (the ACE calculation), otherwise retyped from screenshots
    method?: 'export' | 'screenshots'
  }

  screenshots: string[]

  // A temporarily optional field:
  // M252 is not moved to the new scheme yet.
  ammunition?: Ammunition[]

  // Ballistic profiles (game tables).
  // Several kinds of ammunition may refer to one profile.
  profiles?: Record<string, BallisticProfile>
}
