import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { models, type ModelId } from '../models'
import { artilleryRegistry } from './registry'
import { TABLE_OF, loadTables, statusOf, tablesOf } from './tables'

const ids = Object.keys(models) as ModelId[]

describe('таблицы по требованию', () => {
  it('у каждого орудия есть таблицы, и каждый JSON кому-то нужен', () => {
    expect(Object.keys(TABLE_OF).sort()).toEqual([...ids].sort())
    const files = readdirSync(__dirname).filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/, ''))
    expect([...new Set(Object.values(TABLE_OF))].sort()).toEqual(files.sort())
  })

  it('загруженные по одной таблицы совпадают с каталогом', async () => {
    for (const id of ids) {
      const reference = await loadTables(id)
      expect(reference).toEqual(artilleryRegistry[id])
      expect(tablesOf(id)).toBe(reference)
    }
  })

  it('статус проверки без загрузки таблиц совпадает с JSON', () => {
    for (const id of ids) expect(statusOf(id)).toBe(artilleryRegistry[id].source.status)
  })
})
