#!/usr/bin/env node
/**
 * Range tables straight from the game, without screenshots. In the game the script
 * tools/arma/export_tables.sqf (debug console, in the gunner's seat)
 * calculates all charges with the ACE extension, the same calculation as the
 * "Artillery Table" window, and puts "MACTABLE|…" lines into the clipboard and the RPT.
 * This script sorts them into data-sources/<id>/.
 *
 *   node scripts/import-ace-tables.mjs <id> [source] [--group N] [--write] [--no-import] [--root <folder>]
 *
 * Source (the Windows clipboard by default):
 *   --file <path>   a text with the export (for example, pasted from the clipboard)
 *   --rpt [path]    the game RPT; without a path, the newest one in %LOCALAPPDATA%\Arma 3
 *
 * Without --write it only compares the export with the current files and changes
 * nothing. With --write it writes the files and runs the table import (--no-import
 * skips the import). Tables without air resistance (empty weather columns)
 * go to the weapon folder, tables with it go to advanced/.
 * --group: the magazine set when a weapon has several with different speeds.
 * --vehicle: which export to take when the RPT has several (a part of the vehicle
 * name or class); without it the last export that looks like <id> is taken.
 * --profile: a second shell set of the weapon: files in data-sources/<id>/<set>/
 * (its shell has profile: "<set>" in the JSON).
 * --modes HIGH,LOW: which trajectories to write; by default the ones the weapon
 * has in its JSON (availableModes): a mortar has only the high one.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined
}
const OPTIONS_WITH_VALUE = new Set(['--file', '--rpt', '--group', '--root', '--vehicle', '--profile', '--modes'])
const positional = args.filter((a, i) => !a.startsWith('--') && !OPTIONS_WITH_VALUE.has(args[i - 1]))
const id = positional[0]

function fail(message) {
  console.error(`import-ace-tables: ${message}`)
  process.exit(1)
}


// ---- source ----
function readSource() {
  const file = option('--file')
  if (file) return readFileSync(file, 'utf8')
  if (flag('--rpt')) {
    let rpt = option('--rpt')
    if (!rpt) {
      const dir = join(process.env.LOCALAPPDATA ?? '', 'Arma 3')
      if (!existsSync(dir)) fail(`no folder ${dir}: pass --rpt <path>`)
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.rpt'))
        .map((f) => join(dir, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      if (files.length === 0) fail(`no .rpt files in ${dir}`)
      rpt = files[0]
    }
    console.log(`source: ${rpt}`)
    return readFileSync(rpt, 'utf8')
  }
  try {
    return execFileSync(
      'powershell',
      ['-NoProfile', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Clipboard -Raw'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
  } catch {
    return fail('cannot read the clipboard: pass --file or --rpt')
  }
}

// ---- parsing: all BEGIN…END exports (an RPT may hold several) ----
export function parseExports(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => {
      const at = l.indexOf('MACTABLE|')
      return at < 0 ? null : l.slice(at).replace(/"\s*$/, '').trim()
    })
    .filter((l) => l !== null)
  const starts = lines.flatMap((l, i) => (l.startsWith('MACTABLE|BEGIN|') ? [i] : []))
  return starts.map((start, k) => parseBlock(lines.slice(start, starts[k + 1] ?? lines.length)))
}

function parseBlock(block) {
  const [, , version, vehicle, weapon, minElev, maxElev, apply, ...name] = block[0].split('|')
  const result = {
    version: Number(version),
    vehicle,
    weapon,
    elev: [Number(minElev), Number(maxElev)],
    apply: Number(apply),
    name: name.join('|'),
    groups: [],
    tables: [],
    complete: false,
    mixed: false,
  }
  const tableOf = new Map()
  for (const line of block.slice(1)) {
    const parts = line.split('|')
    if (parts[1] === 'GROUP') {
      result.groups.push({ index: Number(parts[2]), speed: Number(parts[3]), magazines: parts[4].split(',') })
    } else if (parts[1] === 'TABLE') {
      const [, , g, physics, mode, charge, mv, af, expected, got, received] = parts
      const table = {
        group: Number(g),
        physics,
        mode,
        charge: Number(charge),
        mv: Number(mv),
        af: Number(af),
        expected: Number(expected),
        got: Number(got),
        // How many extension answers arrived (old exports have no such field)
        received: received === undefined ? null : Number(received),
        rows: [],
      }
      const key = [g, physics, mode, charge].join('|')
      // The same key twice: two simultaneous runs are mixed in the RPT
      if (tableOf.has(key)) result.mixed = true
      result.tables.push(table)
      tableOf.set(key, table)
    } else if (parts[1] === 'ROW') {
      const [, , g, physics, mode, charge, values] = parts
      tableOf.get([g, physics, mode, charge].join('|'))?.rows.push(values.trim().split(/\s+/))
    } else if (parts[1] === 'END') {
      result.complete = true
      break
    }
  }
  return result
}

/** A file line: 5 columns when the weather ones are empty (as in the other tables), otherwise 12. */
export function formatRow(values) {
  const weatherEmpty = values.slice(5).every((v) => v === '-')
  return (weatherEmpty ? values.slice(0, 5) : values).join(' ')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) main()

/** The export for a weapon: by --vehicle, else the last one that looks like the id, else the only one. */
export function pickExport(exports, id, vehicle) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const text = (e) => norm(`${e.name} ${e.vehicle} ${e.weapon}`)
  if (vehicle) return exports.filter((e) => text(e).includes(norm(vehicle))).at(-1) ?? null
  const key = norm(id.split('_')[0])
  // Interrupted runs without tables do not count
  const filled = exports.filter((e) => e.tables.length > 0)
  return filled.filter((e) => text(e).includes(key)).at(-1) ?? (filled.length === 1 ? filled[0] : null)
}

function main() {
  if (!id) fail('pass a weapon: node scripts/import-ace-tables.mjs <id> [--file|--rpt] [--write]')
  const exports = parseExports(readSource())
  if (exports.length === 0) fail('the source has no "MACTABLE|BEGIN…" export: run tools/arma/export_tables.sqf in the game')
  const data = pickExport(exports, id, option('--vehicle'))
  if (!data) {
    console.log('the source has several exports:')
    for (const e of exports) console.log(`  ${e.name} (${e.vehicle}, ${e.weapon})`)
    fail(`cannot tell which of them is "${id}": pass --vehicle <part of the name>`)
  }
  if (data.mixed) {
    fail('two simultaneous runs of the script are mixed in the export: lines may be swapped. Export the weapon again, in a single run.')
  }
  if (!data.complete) console.warn('⚠ the export is cut off (no MACTABLE|END): only the received tables are used')
  console.log(`weapon in the game: ${data.name} (${data.vehicle}), ${data.weapon}; elevation ${data.elev.join('…')}°`)

  // Magazine set
  if (data.groups.length > 1 && option('--group') === undefined) {
    console.log('the weapon has several magazine sets with different speeds:')
    for (const g of data.groups) console.log(`  --group ${g.index}: ${g.speed} m/s, ${g.magazines.join(', ')}`)
    fail('choose a set: --group N')
  }
  const group = Number(option('--group') ?? data.groups[0]?.index ?? 0)
  const tables = data.tables.filter((t) => t.group === group)
  if (tables.length === 0) fail(`no tables for set ${group}`)

  const root = option('--root') ?? WEB
  const base = join(root, 'data-sources', id, option('--profile') ?? '')
  // The weapon's trajectories: --modes or availableModes from its JSON
  const jsonPath = join(root, 'src', 'data', 'artillery', `${id}.json`)
  const weaponJson = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : null
  const modesOption = option('--modes')
  const modes = modesOption
    ? modesOption.split(',').map((m) => m.trim().toUpperCase())
    : (weaponJson?.availableModes ?? ['HIGH', 'LOW'])
  const skippedModes = [...new Set(tables.map((t) => t.mode))].filter((m) => !modes.includes(m))
  if (skippedModes.length > 0) {
    console.log(`the weapon has no ${skippedModes.join(', ')} trajectories (availableModes), they are not written; pass --modes to take them`)
  }
  // The local date: an export after midnight does not get yesterday's UTC date
  const now = new Date()
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
  const noAirHasDrag = tables.some((t) => t.physics === 'noair' && t.af !== 0)
  if (noAirHasDrag) {
    console.warn('⚠ this ammunition has air resistance in its own config: the game has no table without it')
  }

  if (!tables.some((t) => t.physics === 'air')) {
    console.log('the export has no tables with air resistance: ACE does not calculate them for this weapon or they match the plain ones')
  }

  const planned = []
  let notComputed = 0
  for (const t of tables) {
    if (!modes.includes(t.mode)) continue
    // ACE does not calculate a trajectory that has no suitable angles (a mortar and LOW)
    if (t.received === 0) {
      notComputed += 1
      continue
    }
    // A table "without advanced ballistics" that has air resistance (from the config) is still the main one
    const dir = t.physics === 'air' ? join(base, 'advanced') : base
    const file = join(dir, `${t.mode}-${t.charge}.txt`)
    // ACE skips ranges without a solution (out of the trajectory's reach) in the window too;
    // it is alarming only when not all extension answers arrived
    if (t.received !== null && t.received < t.expected) {
      console.warn(`⚠ ${t.physics} ${t.mode}-${t.charge}: ${t.received} answers of ${t.expected} arrived, the table may be incomplete`)
    }
    if (t.rows.length === 0) continue
    planned.push({ ...t, dir, file })
  }
  if (notComputed > 0) console.log(`tables ACE does not calculate (no suitable angles): ${notComputed}`)

  // Comparison with the current files
  const rowsOf = (file) =>
    existsSync(file)
      ? readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.trim() && !l.startsWith('#'))
          .map((l) => l.trim().split(/\s+/).join(' '))
      : null
  let changedFiles = 0
  for (const p of planned) {
    const now = rowsOf(p.file)
    const next = p.rows.map(formatRow)
    const label = `${p.physics === 'air' ? 'advanced/' : ''}${p.mode}-${p.charge}`
    if (!now) {
      console.log(`${label}: new file, ${next.length} rows (${next[0].split(' ')[0]}–${next.at(-1).split(' ')[0]} m)`)
      changedFiles += 1
      continue
    }
    const a = new Map(now.map((r) => [r.split(' ')[0], r]))
    const b = new Map(next.map((r) => [r.split(' ')[0], r]))
    const changed = [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k))
    const added = [...b.keys()].filter((k) => !a.has(k))
    const removed = [...a.keys()].filter((k) => !b.has(k))
    if (changed.length + added.length + removed.length === 0) {
      console.log(`${label}: matches (${next.length} rows)`)
      continue
    }
    changedFiles += 1
    console.log(`${label}: changed ${changed.length}, new ${added.length}, gone ${removed.length}`)
    for (const k of changed.slice(0, 3)) console.log(`    was ${a.get(k)}\n    now ${b.get(k)}`)
  }
  // Old tables with weather corrections in the folder without air resistance: the game
  // has no such table without air resistance (the ACE calculation stops at
  // 29,900 m, and the high trajectory of the far charges lies entirely beyond it), and with
  // weather it is already in the export for advanced/. Such files do harm: the weapon
  // counts as incomplete and is hidden from the list
  const stale = []
  for (const dir of [base, join(base, 'advanced')]) {
    if (!existsSync(dir)) continue
    const planneds = new Set(planned.filter((p) => p.dir === dir).map((p) => `${p.mode}-${p.charge}.txt`))
    const extra = readdirSync(dir).filter((f) => /^(HIGH|LOW)-\d+\.txt$/.test(f) && !planneds.has(f))
    if (!extra.length || !planned.some((p) => p.dir === dir)) continue
    const keep = []
    for (const f of extra) {
      const withWeather = readFileSync(join(dir, f), 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim().split(/\s+/))
        .some((cells) => cells[0] !== '#' && cells.length === 12 && cells.slice(5).some((v) => v !== '-'))
      const inAdvanced = planned.some((p) => p.physics === 'air' && `${p.mode}-${p.charge}.txt` === f)
      if (dir === base && withWeather && inAdvanced) stale.push(join(dir, f))
      else keep.push(f)
    }
    if (keep.length) console.log(`${dir} has files that are not in the export (left as they are): ${keep.join(', ')}`)
  }
  if (stale.length) {
    const names = stale.map((f) => f.split(/[\\/]/).pop()).join(', ')
    console.log(`tables with air resistance in the folder without it (the game has none without it, with it they are in advanced/), removed: ${names}`)
    changedFiles += stale.length
  }

  if (!flag('--write')) {
    console.log(`\nfiles to write: ${changedFiles}. This is only a comparison: add --write to write them.`)
    return
  }

  for (const p of planned) {
    mkdirSync(p.dir, { recursive: true })
    // The weapon name as in the app (from its JSON), otherwise as in the game
    const title = weaponJson?.name ?? data.name
    const header = [
      `# ${title}, ${p.mode}, Charge ${p.charge}`,
      `# Exported from the game ${today} by tools/arma/export_tables.sqf (ACE calculation): ${data.weapon}, ${p.mv} m/s, air friction ${p.af}.`,
      p.af === 0
        ? '# Without air resistance: the weather columns are empty.'
        : '# With air resistance (ACE advanced ballistics).',
    ]
    writeFileSync(p.file, [...header, ...p.rows.map(formatRow)].join('\n') + '\n')
  }
  for (const f of stale) unlinkSync(f)
  console.log(`files written: ${planned.length}${stale.length ? `, removed: ${stale.length}` : ''}`)
  if (flag('--no-import')) return
  execFileSync('node', [join(WEB, 'scripts', 'import-tables.mjs'), '--all'], { cwd: WEB, stdio: 'inherit' })
}
