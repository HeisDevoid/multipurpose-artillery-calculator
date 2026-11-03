import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SCRIPT = join(__dirname, '../../scripts/import-ace-tables.mjs')
const SOURCES = join(__dirname, '../../data-sources/sholef')

// Строки таблицы из файла data-sources, как их отдаёт расширение ACE: 12 значений
const rowsOf = (file: string) =>
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => {
      const values = l.trim().split(/\s+/)
      return [...values, ...Array(12 - values.length).fill('-')].join(' ')
    })

/** Выгрузка в виде RPT: строки в кавычках, с временем, вперемешку с шумом. */
function rpt(): string {
  const high0 = rowsOf(join(SOURCES, 'HIGH-0.txt'))
  const airLow1 = rowsOf(join(SOURCES, 'advanced/LOW-1.txt'))
  return [
    '19:00:00 шум до выгрузки',
    '19:00:01 MACTABLE|BEGIN|1|B_MBT_01_arty_F|mortar_155mm_AMOS|-5|80|1|Sholef',
    '19:00:01 MACTABLE|GROUP|0|810|32Rnd_155mm_Mo_shells,6Rnd_155mm_Mo_smoke',
    `19:00:02 MACTABLE|TABLE|0|noair|HIGH|0|153.9|0|${high0.length + 2}|${high0.length}`,
    ...high0.map((r) => `19:00:02 MACTABLE|ROW|0|noair|HIGH|0|${r}`),
    `19:00:03 MACTABLE|TABLE|0|air|LOW|1|243|-6e-005|${airLow1.length}|${airLow1.length}`,
    ...airLow1.map((r) => `19:00:03 MACTABLE|ROW|0|air|LOW|1|${r}`),
    '19:00:04 MACTABLE|END|2',
    '19:00:05 шум после',
    // Следующая выгрузка другого орудия в том же RPT
    '19:01:00 MACTABLE|BEGIN|1|B_MBT_01_mlrs_F|rockets_230mm_GAT|5|66|1|Seara',
    '19:01:00 MACTABLE|GROUP|0|850|12Rnd_230mm_rockets',
    '19:01:01 MACTABLE|TABLE|0|noair|HIGH|0|425|0|3|1|3',
    '19:01:01 MACTABLE|ROW|0|noair|HIGH|0|1000 1132 - - 20.3 - - - - - - -',
    '19:01:02 MACTABLE|END|1',
  ].join('\n')
}

function run(root: string, extra: string[]) {
  const file = join(root, 'export.rpt')
  writeFileSync(file, rpt())
  return execFileSync('node', [SCRIPT, 'sholef', '--rpt', file, '--root', root, '--no-import', ...extra], {
    encoding: 'utf8',
  })
}

describe('scripts/import-ace-tables.mjs', () => {
  it('сравнивает выгрузку из игры с текущими таблицами и без --write ничего не меняет', () => {
    const root = mkdtempSync(join(tmpdir(), 'ace-'))
    cpSync(SOURCES, join(root, 'data-sources/sholef'), { recursive: true })
    const before = readFileSync(join(root, 'data-sources/sholef/HIGH-0.txt'), 'utf8')
    const out = run(root, [])
    expect(out).toContain('HIGH-0: совпадает')
    expect(out).toContain('advanced/LOW-1: совпадает')
    expect(out).toContain('только сравнение')
    // Из двух выгрузок взята та, что про Sholef
    expect(out).toContain('орудие в игре: Sholef')
    expect(readFileSync(join(root, 'data-sources/sholef/HIGH-0.txt'), 'utf8')).toBe(before)
  })

  it('с --write раскладывает: без сопротивления — 5 столбцов в папку орудия, с ним — 12 в advanced/', () => {
    const root = mkdtempSync(join(tmpdir(), 'ace-'))
    run(root, ['--write'])
    const high0 = readFileSync(join(root, 'data-sources/sholef/HIGH-0.txt'), 'utf8').split('\n')
    expect(high0[0]).toBe('# Sholef, HIGH, Charge 0')
    expect(high0[1]).toContain('153.9 м/с, сопротивление воздуха 0')
    expect(high0[3].split(' ')).toHaveLength(5)
    const low1 = readFileSync(join(root, 'data-sources/sholef/advanced/LOW-1.txt'), 'utf8').split('\n')
    expect(low1[2]).toContain('С сопротивлением воздуха')
    expect(low1[3].split(' ')).toHaveLength(12)
  })

  it('без выгрузки в источнике — понятная ошибка', () => {
    const root = mkdtempSync(join(tmpdir(), 'ace-'))
    writeFileSync(join(root, 'empty.txt'), 'ничего нет')
    expect(() =>
      execFileSync('node', [SCRIPT, 'sholef', '--file', join(root, 'empty.txt')], { encoding: 'utf8', stdio: 'pipe' })
    ).toThrow(/MACTABLE/)
  })
})
