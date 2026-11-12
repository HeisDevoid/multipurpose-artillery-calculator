#!/usr/bin/env node
/**
 * Imports ACE3 game tables from text files into the JSON reference.
 *
 *   node scripts/import-tables.mjs <source-folder> <json> [--profile default] [--check]
 *   node scripts/import-tables.mjs --all [--check]
 *
 * The folder holds <MODE>-<charge>.txt files.
 * The script replaces profiles.<profile>.modes / columns / units in the JSON
 * and leaves the other fields of the reference alone.
 *
 * --all: every data-sources/<id> folder → src/data/artillery/<id>.json.
 * --check: write nothing and only compare: exit code 1
 * when the JSON does not match the text sources.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_COLUMNS = ['range', 'elevation', 'dElevPer100m', 'dTofPer100m', 'tof']
const WEATHER_COLUMNS = [
  'azimuthPerCrosswind',
  'rangePerHeadwind',
  'rangePerTailwind',
  'rangePerTempDec',
  'rangePerTempInc',
  'rangePerDensityDec',
  'rangePerDensityInc',
]
const UNITS = {
  range: 'm',
  elevation: 'mil',
  dElevPer100m: 'mil',
  dTofPer100m: 's',
  tof: 's',
  azimuthPerCrosswind: 'mil per 1 m/s',
  rangePerHeadwind: 'm per 1 m/s',
  rangePerTailwind: 'm per 1 m/s',
  rangePerTempDec: 'm per 1 °C',
  rangePerTempInc: 'm per 1 °C',
  rangePerDensityDec: 'm per 1 %',
  rangePerDensityInc: 'm per 1 %',
}
const FILE_RE = /^(HIGH|LOW)-(\d+)\.txt$/

function fail(message) {
  console.error(`import-tables: ${message}`)
  process.exit(1)
}

function parseValue(token, where, column) {
  if (token === '-') {
    // A dash is allowed anywhere except range, elevation and time of flight.
    if (column === 0 || column === 1 || column === 4) {
      fail(`${where}: a dash in the required column ${column + 1}`)
    }
    return null
  }
  const value = Number(token)
  if (!Number.isFinite(value)) fail(`${where}: not a number "${token}"`)
  // "-0.0" from the game → 0
  return value === 0 ? 0 : value
}

function parseTable(path) {
  const rows = []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)

  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) return

    const where = `${path}:${index + 1}`
    const tokens = line.split(/\s+/)
    if (tokens.length !== 5 && tokens.length !== 12) {
      fail(`${where}: expected 5 or 12 columns, found ${tokens.length}`)
    }

    const row = tokens.map((token, column) => parseValue(token, where, column))
    const previous = rows[rows.length - 1]

    if (previous) {
      if (row[0] <= previous[0]) fail(`${where}: the range does not increase`)
      if (row.length !== previous.length) {
        fail(`${where}: a different number of columns in one table`)
      }
    }
    rows.push(row)
  })

  if (rows.length === 0) fail(`${path}: an empty table`)
  return rows
}

function readSources(dir) {
  const modes = {}
  let width = 5

  const files = readdirSync(dir)
    .map((name) => ({ name, match: FILE_RE.exec(name) }))
    .filter(({ match }) => match !== null)
    .sort((a, b) =>
      a.match[1] === b.match[1]
        ? Number(a.match[2]) - Number(b.match[2])
        : a.match[1] < b.match[1] ? -1 : 1
    )

  if (files.length === 0) fail(`${dir}: no <MODE>-<charge>.txt files`)

  for (const { name, match } of files) {
    const [, mode, charge] = match
    const rows = parseTable(join(dir, name))
    width = Math.max(width, rows[0].length)
    modes[mode] ??= {}
    modes[mode][String(Number(charge))] = rows
  }

  return { modes, width }
}

/** JSON with an indent of 2, but arrays of primitives on one line. */
function serialize(value, indent = '') {
  const inner = `${indent}  `

  if (Array.isArray(value)) {
    if (value.every((item) => item === null || typeof item !== 'object')) {
      return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
    }
    return `[\n${value
      .map((item) => inner + serialize(item, inner))
      .join(',\n')}\n${indent}]`
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    return `{\n${entries
      .map(([key, item]) => `${inner}${JSON.stringify(key)}: ${serialize(item, inner)}`)
      .join(',\n')}\n${indent}}`
  }

  return JSON.stringify(value)
}

function importOne(sourceDir, jsonPath, profileKey, check) {
  const { modes, width } = readSources(sourceDir)

  const original = readFileSync(jsonPath, 'utf8')
  const data = JSON.parse(original)
  data.profiles ??= {}

  const columns =
    width === 12 ? [...BASE_COLUMNS, ...WEATHER_COLUMNS] : BASE_COLUMNS
  const previous = data.profiles[profileKey] ?? {}

  data.profiles[profileKey] = {
    columns,
    units: Object.fromEntries(columns.map((c) => [c, UNITS[c]])),
    ...(previous.notes !== undefined ? { notes: previous.notes } : {}),
    modes,
  }

  // A profile with air resistance is attached to the ammunition of its own set:
  // "advanced" to the main one (default), "<set>-advanced" to the set <set>
  if (profileKey === 'advanced' || profileKey.endsWith('-advanced')) {
    const base = profileKey === 'advanced' ? 'default' : profileKey.slice(0, -'-advanced'.length)
    for (const ammo of data.ammunition ?? []) {
      if (ammo.profile === base) ammo.advancedProfile = profileKey
    }
  }

  const output = `${serialize(data)}\n`
  const normalized = original.replace(/\r\n/g, '\n')

  if (check) {
    if (output !== normalized) {
      fail(`${jsonPath} does not match ${sourceDir}. Run without --check.`)
    }
    console.log(`ok  ${jsonPath}`)
    return
  }

  writeFileSync(jsonPath, output)
  const charges = Object.entries(modes)
    .map(([mode, tables]) => `${mode}: ${Object.keys(tables).join(', ')}`)
    .join('; ')
  console.log(`written ${jsonPath} (${charges})`)
}

// A table with weather corrections was taken with air resistance (see lib/profileSelect.ts)
function hasDrag(profile) {
  return Object.values(profile?.modes ?? {}).some((tables) =>
    Object.values(tables ?? {}).some((rows) =>
      rows.some((row) => row.length > 5 && row.slice(5).some((value) => value !== null))
    )
  )
}

const modesOf = (profile) =>
  Object.entries(profile?.modes ?? {})
    .filter(([, tables]) => tables && Object.keys(tables).length > 0)
    .map(([mode]) => mode)

/**
 * Which tables a weapon lacks: 'no-air' is without air resistance,
 * 'air' is with it (for at least one shell and trajectory).
 */
function missingTables(data) {
  const missing = new Set()
  for (const ammo of data.ammunition ?? [{}]) {
    const profiles = [ammo.profile ?? 'default', ammo.advancedProfile]
      .filter(Boolean)
      .map((key) => data.profiles?.[key])
      .filter(Boolean)
    const noAir = new Set(profiles.filter((p) => !hasDrag(p)).flatMap(modesOf))
    const air = new Set(profiles.filter(hasDrag).flatMap(modesOf))
    for (const mode of data.availableModes) {
      if (!noAir.has(mode)) missing.add('no-air')
      if (!air.has(mode)) missing.add('air')
    }
  }
  return [...missing].sort()
}

const args = process.argv.slice(2)
const check = args.includes('--check')
const all = args.includes('--all')
const profileIndex = args.indexOf('--profile')
const profileKey = profileIndex >= 0 ? args[profileIndex + 1] : 'default'
const positional = args.filter(
  (arg, i) =>
    !arg.startsWith('--') && (profileIndex < 0 || i !== profileIndex + 1)
)

if (all) {
  // Every data-sources/<id> folder ↔ src/data/artillery/<id>.json
  const root = 'data-sources'
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const json = join('src', 'data', 'artillery', `${entry.name}.json`)
    importOne(join(root, entry.name), json, 'default', check)
    // data-sources/<id>/advanced: tables for advanced ballistics
    const advanced = join(root, entry.name, 'advanced')
    if (existsSync(advanced)) importOne(advanced, json, 'advanced', check)
    // Other subfolders are shell sets with another speed (profile = folder name),
    // each may have an advanced/ of its own
    for (const sub of readdirSync(join(root, entry.name), { withFileTypes: true })) {
      if (!sub.isDirectory() || sub.name === 'advanced') continue
      importOne(join(root, entry.name, sub.name), json, sub.name, check)
      const subAdvanced = join(root, entry.name, sub.name, 'advanced')
      if (existsSync(subAdvanced)) importOne(subAdvanced, json, `${sub.name}-advanced`, check)
    }
  }

  // Verification statuses and table completeness of all weapons go to a separate
  // small file: the weapon list shows them at once, and the tables themselves load
  // only when a weapon is selected
  const tablesDir = join('src', 'data', 'artillery')
  const status = Object.fromEntries(
    readdirSync(tablesDir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => {
        const data = JSON.parse(readFileSync(join(tablesDir, name), 'utf8'))
        return [name.replace(/\.json$/, ''), { status: data.source.status, missing: missingTables(data) }]
      })
  )
  const statusPath = join('src', 'data', 'tableStatus.json')
  const statusOutput = `${JSON.stringify(status, null, 2)}\n`
  const currentStatus = existsSync(statusPath) ? readFileSync(statusPath, 'utf8').replace(/\r\n/g, '\n') : ''
  if (currentStatus !== statusOutput) {
    if (check) fail(`${statusPath} is out of date. Run npm run tables:import.`)
    writeFileSync(statusPath, statusOutput)
    console.log(`written ${statusPath}`)
  }
} else {
  if (positional.length !== 2 || !profileKey) {
    fail(
      'usage: import-tables.mjs <folder> <json> [--profile <key>] [--check] | --all [--check]'
    )
  }
  importOne(positional[0], positional[1], profileKey, check)
}
