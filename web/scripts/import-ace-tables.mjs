#!/usr/bin/env node
/**
 * Таблицы стрельбы прямо из игры, без скриншотов. В игре скрипт
 * tools/arma/export_tables.sqf (отладочная консоль, на месте наводчика)
 * считает все заряды расширением ACE — тем же расчётом, что окно
 * «Artillery Table», — и кладёт строки «MACTABLE|…» в буфер обмена и в RPT.
 * Этот скрипт раскладывает их по data-sources/<id>/.
 *
 *   node scripts/import-ace-tables.mjs <id> [источник] [--group N] [--write] [--no-import] [--root <папка>]
 *
 * Источник (по умолчанию — буфер обмена Windows):
 *   --file <путь>   текст с выгрузкой (например, вставленный из буфера)
 *   --rpt [путь]    RPT игры; без пути — самый новый из %LOCALAPPDATA%\Arma 3
 *
 * Без --write только сравнивает выгрузку с текущими файлами и ничего не
 * меняет. С --write пишет файлы и запускает импорт таблиц (--no-import —
 * без импорта). Таблицы без сопротивления воздуха (погодные столбцы
 * пустые) ложатся в папку орудия, с сопротивлением — в advanced/.
 * --group — набор магазинов, если у орудия их несколько с разной скоростью.
 * --vehicle — какую выгрузку взять, если в RPT их несколько (часть названия
 * или класса техники); без него берётся последняя выгрузка, похожая на <id>.
 * --profile — второй набор снарядов орудия: файлы в data-sources/<id>/<набор>/
 * (у его снаряда в JSON profile: «<набор>»).
 * --modes HIGH,LOW — какие траектории писать; по умолчанию те, что есть у
 * орудия в JSON (availableModes): у миномёта только навесная.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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


// ---- источник ----
function readSource() {
  const file = option('--file')
  if (file) return readFileSync(file, 'utf8')
  if (flag('--rpt')) {
    let rpt = option('--rpt')
    if (!rpt) {
      const dir = join(process.env.LOCALAPPDATA ?? '', 'Arma 3')
      if (!existsSync(dir)) fail(`нет папки ${dir}: укажите --rpt <путь>`)
      const files = readdirSync(dir)
        .filter((f) => f.endsWith('.rpt'))
        .map((f) => join(dir, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      if (files.length === 0) fail(`в ${dir} нет файлов .rpt`)
      rpt = files[0]
    }
    console.log(`источник: ${rpt}`)
    return readFileSync(rpt, 'utf8')
  }
  try {
    return execFileSync(
      'powershell',
      ['-NoProfile', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-Clipboard -Raw'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
  } catch {
    return fail('не удалось прочитать буфер обмена: укажите --file или --rpt')
  }
}

// ---- разбор: все выгрузки BEGIN…END (в RPT их может быть несколько) ----
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
        // Сколько ответов расширения пришло (в старых выгрузках поля нет)
        received: received === undefined ? null : Number(received),
        rows: [],
      }
      const key = [g, physics, mode, charge].join('|')
      // Один и тот же ключ дважды — в RPT перемешаны два одновременных запуска
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

/** Строка файла: 5 столбцов, если погодные пустые (как в остальных таблицах), иначе 12. */
export function formatRow(values) {
  const weatherEmpty = values.slice(5).every((v) => v === '-')
  return (weatherEmpty ? values.slice(0, 5) : values).join(' ')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) main()

/** Выгрузка для орудия: по --vehicle, иначе последняя похожая на id, иначе единственная. */
export function pickExport(exports, id, vehicle) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const text = (e) => norm(`${e.name} ${e.vehicle} ${e.weapon}`)
  if (vehicle) return exports.filter((e) => text(e).includes(norm(vehicle))).at(-1) ?? null
  const key = norm(id.split('_')[0])
  // Оборванные запуски без таблиц не считаются
  const filled = exports.filter((e) => e.tables.length > 0)
  return filled.filter((e) => text(e).includes(key)).at(-1) ?? (filled.length === 1 ? filled[0] : null)
}

function main() {
  if (!id) fail('укажите орудие: node scripts/import-ace-tables.mjs <id> [--file|--rpt] [--write]')
  const exports = parseExports(readSource())
  if (exports.length === 0) fail('в источнике нет выгрузки «MACTABLE|BEGIN…»: запустите tools/arma/export_tables.sqf в игре')
  const data = pickExport(exports, id, option('--vehicle'))
  if (!data) {
    console.log('в источнике несколько выгрузок:')
    for (const e of exports) console.log(`  ${e.name} (${e.vehicle}, ${e.weapon})`)
    fail(`не понял, какая из них «${id}»: укажите --vehicle <часть названия>`)
  }
  if (data.mixed) {
    fail('в выгрузке перемешаны два запуска скрипта одновременно: строки могли перепутаться. Выгрузите орудие ещё раз, одним запуском.')
  }
  if (!data.complete) console.warn('⚠ выгрузка оборвана (нет MACTABLE|END): берутся только полученные таблицы')
  console.log(`орудие в игре: ${data.name} (${data.vehicle}), ${data.weapon}; возвышение ${data.elev.join('…')}°`)

  // Набор магазинов
  if (data.groups.length > 1 && option('--group') === undefined) {
    console.log('у орудия несколько наборов магазинов с разной скоростью:')
    for (const g of data.groups) console.log(`  --group ${g.index}: ${g.speed} м/с — ${g.magazines.join(', ')}`)
    fail('выберите набор: --group N')
  }
  const group = Number(option('--group') ?? data.groups[0]?.index ?? 0)
  const tables = data.tables.filter((t) => t.group === group)
  if (tables.length === 0) fail(`нет таблиц для набора ${group}`)

  const root = option('--root') ?? WEB
  const base = join(root, 'data-sources', id, option('--profile') ?? '')
  // Траектории орудия: --modes или availableModes из его JSON
  const jsonPath = join(root, 'src', 'data', 'artillery', `${id}.json`)
  const weaponJson = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : null
  const modesOption = option('--modes')
  const modes = modesOption
    ? modesOption.split(',').map((m) => m.trim().toUpperCase())
    : (weaponJson?.availableModes ?? ['HIGH', 'LOW'])
  const skippedModes = [...new Set(tables.map((t) => t.mode))].filter((m) => !modes.includes(m))
  if (skippedModes.length > 0) {
    console.log(`траектории ${skippedModes.join(', ')} у орудия нет (availableModes), они не пишутся; --modes, чтобы взять`)
  }
  // Местная дата: выгрузка после полуночи не получает вчерашнее число по UTC
  const now = new Date()
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, '0')).join('-')
  const noAirHasDrag = tables.some((t) => t.physics === 'noair' && t.af !== 0)
  if (noAirHasDrag) {
    console.warn('⚠ у этого боеприпаса сопротивление воздуха включено в самом конфиге: таблицы без него в игре не бывает')
  }

  if (!tables.some((t) => t.physics === 'air')) {
    console.log('таблиц с сопротивлением в выгрузке нет: ACE их для этого орудия не считает или они совпадают с обычными')
  }

  const planned = []
  let notComputed = 0
  for (const t of tables) {
    if (!modes.includes(t.mode)) continue
    // ACE не считает траекторию, если для неё нет подходящих углов (миномёт и LOW)
    if (t.received === 0) {
      notComputed += 1
      continue
    }
    // Таблица «без улучшенной баллистики» с сопротивлением (из конфига) — всё равно основная
    const dir = t.physics === 'air' ? join(base, 'advanced') : base
    const file = join(dir, `${t.mode}-${t.charge}.txt`)
    // Дальности без решения (вне досягаемости траектории) ACE пропускает и в окне;
    // тревожно только если ответы расширения пришли не все
    if (t.received !== null && t.received < t.expected) {
      console.warn(`⚠ ${t.physics} ${t.mode}-${t.charge}: пришло ${t.received} ответов из ${t.expected}, таблица может быть неполной`)
    }
    if (t.rows.length === 0) continue
    planned.push({ ...t, dir, file })
  }
  if (notComputed > 0) console.log(`таблиц, которые ACE не считает (нет подходящих углов): ${notComputed}`)

  // Сравнение с текущими файлами
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
      console.log(`${label}: новый файл, ${next.length} строк (${next[0].split(' ')[0]}–${next.at(-1).split(' ')[0]} м)`)
      changedFiles += 1
      continue
    }
    const a = new Map(now.map((r) => [r.split(' ')[0], r]))
    const b = new Map(next.map((r) => [r.split(' ')[0], r]))
    const changed = [...b.keys()].filter((k) => a.has(k) && a.get(k) !== b.get(k))
    const added = [...b.keys()].filter((k) => !a.has(k))
    const removed = [...a.keys()].filter((k) => !b.has(k))
    if (changed.length + added.length + removed.length === 0) {
      console.log(`${label}: совпадает (${next.length} строк)`)
      continue
    }
    changedFiles += 1
    console.log(`${label}: изменено ${changed.length}, новых ${added.length}, пропало ${removed.length}`)
    for (const k of changed.slice(0, 3)) console.log(`    было  ${a.get(k)}\n    стало ${b.get(k)}`)
  }
  for (const dir of [base, join(base, 'advanced')]) {
    if (!existsSync(dir)) continue
    const planneds = new Set(planned.filter((p) => p.dir === dir).map((p) => `${p.mode}-${p.charge}.txt`))
    const extra = readdirSync(dir).filter((f) => /^(HIGH|LOW)-\d+\.txt$/.test(f) && !planneds.has(f))
    if (extra.length && planned.some((p) => p.dir === dir)) {
      console.log(`в ${dir} есть файлы, которых нет в выгрузке (оставлены как есть): ${extra.join(', ')}`)
    }
  }

  if (!flag('--write')) {
    console.log(`\nфайлов к записи: ${changedFiles}. Это только сравнение: добавьте --write, чтобы записать.`)
    return
  }

  for (const p of planned) {
    mkdirSync(p.dir, { recursive: true })
    // Название орудия как в приложении (из его JSON), иначе как в игре
    const title = weaponJson?.name ?? data.name
    const header = [
      `# ${title}, ${p.mode}, Charge ${p.charge}`,
      `# Выгружено из игры ${today} скриптом tools/arma/export_tables.sqf (расчёт ACE): ${data.weapon}, ${p.mv} м/с, сопротивление воздуха ${p.af}.`,
      p.af === 0
        ? '# Без сопротивления воздуха: погодные столбцы пустые.'
        : '# С сопротивлением воздуха (улучшенная баллистика ACE).',
    ]
    writeFileSync(p.file, [...header, ...p.rows.map(formatRow)].join('\n') + '\n')
  }
  console.log(`записано файлов: ${planned.length}`)
  if (flag('--no-import')) return
  execFileSync('node', [join(WEB, 'scripts', 'import-tables.mjs'), '--all'], { cwd: WEB, stdio: 'inherit' })
}
