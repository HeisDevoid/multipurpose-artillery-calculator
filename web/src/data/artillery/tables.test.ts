import { readdirSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { models, type ModelId } from '../models'
import { artilleryRegistry } from './registry'
import { TABLE_OF, loadTables, statusOf, tablesOf } from './tables'

const ids = Object.keys(models) as ModelId[]

describe('tables on demand', () => {
  it('every weapon has tables, and every JSON is needed by someone', () => {
    expect(Object.keys(TABLE_OF).sort()).toEqual([...ids].sort())
    const files = readdirSync(__dirname).filter((name) => name.endsWith('.json')).map((name) => name.replace(/\.json$/, ''))
    expect([...new Set(Object.values(TABLE_OF))].sort()).toEqual(files.sort())
  })

  it('tables loaded one by one match the catalogue', async () => {
    for (const id of ids) {
      const reference = await loadTables(id)
      expect(reference).toEqual(artilleryRegistry[id])
      expect(tablesOf(id)).toBe(reference)
    }
  })

  it('the verification status without loading the tables matches the JSON', () => {
    for (const id of ids) expect(statusOf(id)).toBe(artilleryRegistry[id].source.status)
  })
})
