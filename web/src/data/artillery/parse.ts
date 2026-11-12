/**
 * Validation of a weapon JSON reference: the table shape, ammunition, profiles.
 * Separate from the catalogue: the app loads weapon tables one by one.
 */
import type { ArtilleryReference } from '../../types/artillery'

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isAmmunition(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.designation === 'string' &&
    typeof value.type === 'string' &&
    typeof value.description === 'string' &&
    typeof value.verified === 'boolean' &&
    (value.charges === undefined ||
      (Array.isArray(value.charges) &&
        value.charges.every(
          (c: unknown) =>
            typeof c === 'number' && Number.isInteger(c) && c >= 0
        ))) &&
    (value.profile === undefined ||
      typeof value.profile === 'string')
  )
}

// Required values: range, elevation, time of flight.
// The other columns may hold a dash (null).
const REQUIRED_COLUMNS = new Set([0, 1, 4])

function isBallisticRow(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    (value.length === 5 || value.length === 12) &&
    value.every((item: unknown, index: number) =>
      item === null
        ? !REQUIRED_COLUMNS.has(index)
        : typeof item === 'number' && Number.isFinite(item)
    )
  )
}

function isChargeTable(rows: unknown): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false
  if (!rows.every(isBallisticRow)) return false

  for (let i = 1; i < rows.length; i += 1) {
    // The range must strictly increase, otherwise interpolation
    // gives a wrong result.
    if (rows[i][0] <= rows[i - 1][0]) return false
    // All rows of one table have the same width.
    if (rows[i].length !== rows[0].length) return false
  }

  return true
}

function isProfile(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.modes)) return false

  return Object.values(value.modes).every(
    (charges) =>
      isObject(charges) &&
      Object.entries(charges).every(
        ([charge, rows]) =>
          /^\d+$/.test(charge) && isChargeTable(rows)
      )
  )
}

export function parseReference(
  data: unknown,
  expectedId: string
): ArtilleryReference {
  if (!isObject(data) || !isObject(data.source)) {
    throw new Error(`Invalid model: ${expectedId}`)
  }

  const validModes =
    Array.isArray(data.availableModes) &&
    data.availableModes.length > 0 &&
    data.availableModes.every(
      (mode: unknown) => mode === 'HIGH' || mode === 'LOW'
    )

  const validScreenshots =
    Array.isArray(data.screenshots) &&
    data.screenshots.every(
      (item: unknown) => typeof item === 'string'
    )

  const validAmmunition =
    data.ammunition === undefined ||
    (
      Array.isArray(data.ammunition) &&
      data.ammunition.length > 0 &&
      data.ammunition.every(isAmmunition) &&
      new Set(
        data.ammunition.map(
          (item: { id: string }) => item.id
        )
      ).size === data.ammunition.length
    )

  const validProfiles =
    data.profiles === undefined ||
    (isObject(data.profiles) &&
      Object.values(data.profiles).every(isProfile))

  // Every ammunition link to a profile must point
  // to an existing profile, and the declared charges must be
  // in the tables of that profile.
  const profileRefsOk =
    !Array.isArray(data.ammunition) ||
    data.ammunition.every(
      (item: { profile?: string; advancedProfile?: string; charges?: number[] }) => {
        if (
          item.advancedProfile !== undefined &&
          !(isObject(data.profiles) && item.advancedProfile in data.profiles)
        ) {
          return false
        }
        if (item.profile === undefined) return true
        if (!isObject(data.profiles)) return false

        const profile = data.profiles[item.profile]
        if (!isObject(profile) || !isObject(profile.modes)) return false

        const tables = Object.values(profile.modes).filter(isObject)
        return (item.charges ?? []).every((charge) =>
          tables.some((charges) => String(charge) in charges)
        )
      }
    )

  const validStatus =
    data.source.status === 'pending' ||
    data.source.status === 'in-progress' ||
    data.source.status === 'verified'

  if (
    data.schemaVersion !== 1 ||
    data.id !== expectedId ||
    typeof data.name !== 'string' ||
    typeof data.modification !== 'string' ||
    typeof data.source.name !== 'string' ||
    !(data.source.method === undefined || data.source.method === 'export' || data.source.method === 'screenshots') ||
    !validStatus ||
    !validModes ||
    !validScreenshots ||
    !validAmmunition ||
    !validProfiles ||
    !profileRefsOk
  ) {
    throw new Error(`Invalid model: ${expectedId}`)
  }

  return data as unknown as ArtilleryReference
}
