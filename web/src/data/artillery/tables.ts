import { useEffect, useState } from 'react'

import { isModelId, models, type ModelId } from '../models'
import tableStatus from '../tableStatus.json'
import type { ArtilleryReference, DataStatus } from '../../types/artillery'
import { parseReference } from './parse'

/**
 * Range tables in the app: every weapon has a build file of its own, it is
 * loaded when the weapon is selected (the selected one before the first render),
 * the rest in the background, so that the site works offline too.
 */

// Which JSON reference belongs to which weapon
export const TABLE_OF = {
  mk6: 'mk6',
  m252: 'm252_rhsusaf',
  m29: 'm29_sog',
  m2: 'm2_sog',
  m101: 'm101_sog',
  seara: 'seara',
  d44: 'd44_sog',
  h12: 'h12_sog',
  kamaz: 'kamaz_mrl',
  m109a6: 'm109a6_rhsusaf',
  m119a2: 'm119a2_rhsusaf',
  m777: 'm777_sod',
  sholef: 'sholef',
  sochor: 'sochor',
  type53: 'type53_sog',
  type63: 'type63_sog',
  d30: 'd30_rhs',
  gvozdika: 'gvozdika_rhs',
  bm21: 'bm21_rhs',
  podnos: 'podnos_rhs',
  himars: 'himars_rhs',
} as const satisfies Record<ModelId, string>

const files = import.meta.glob<{ default: unknown }>('./*.json')

const loaded = new Map<ModelId, ArtilleryReference>()
const loading = new Map<ModelId, Promise<ArtilleryReference>>()

/** The weapon tables, if already loaded. */
export function tablesOf(id: ModelId): ArtilleryReference | undefined {
  return loaded.get(id)
}

/** Load the weapon tables (a repeated call waits for the same load). */
export function loadTables(id: ModelId): Promise<ArtilleryReference> {
  const ready = loaded.get(id)
  if (ready) return Promise.resolve(ready)
  let promise = loading.get(id)
  if (!promise) {
    const file = TABLE_OF[id]
    promise = files[`./${file}.json`]()
      .then((module) => {
        const reference = parseReference(module.default, file)
        loaded.set(id, reference)
        return reference
      })
      .finally(() => loading.delete(id))
    loading.set(id, promise)
  }
  return promise
}

/** All tables in the background, one by one: then the weapon changes instantly and offline. */
export async function preloadAllTables() {
  for (const id of Object.keys(TABLE_OF) as ModelId[]) {
    await loadTables(id).catch(() => undefined)
  }
}

/** Which tables are missing: without air resistance ('no-air') or with it ('air'). */
export type MissingTables = 'air' | 'no-air'

const statusIndex = tableStatus as Record<string, { status: DataStatus; missing: MissingTables[] }>

/** Whether the tables are verified in the game, without loading the tables themselves. */
export function statusOf(id: ModelId): DataStatus {
  return statusIndex[TABLE_OF[id]]?.status ?? 'pending'
}

/** Incomplete tables: which sets are missing (empty: both are there). */
export function missingTablesOf(id: ModelId): MissingTables[] {
  return statusIndex[TABLE_OF[id]]?.missing ?? []
}

/**
 * A weapon in the list has both table sets, with air resistance
 * and without. With one set the settings would be wrong on some servers.
 */
export function isAvailableModel(value: string): value is ModelId {
  return isModelId(value) && missingTablesOf(value).length === 0
}

/** The weapons in the list, in the reference order. */
export const availableModelIds = (Object.keys(models) as ModelId[]).filter(isAvailableModel)

/** The weapon at start: the one chosen earlier (as in App), else Mk6. */
export function initialModelId(): ModelId {
  try {
    const stored = localStorage.getItem('selectedModel')
    if (stored && isAvailableModel(stored)) return stored
  } catch {
    // Storage is unavailable.
  }
  return 'mk6'
}

/**
 * The tables of the selected weapon. While a new weapon loads, the tables
 * of the previous one stay (with its id), so that the screen does not flicker.
 */
export function useTables(id: ModelId): { id: ModelId; reference: ArtilleryReference } | null {
  const [last, setLast] = useState<{ id: ModelId; reference: ArtilleryReference } | null>(() => {
    const reference = tablesOf(id)
    return reference ? { id, reference } : null
  })
  useEffect(() => {
    if (tablesOf(id)) return
    let alive = true
    void loadTables(id).then((reference) => {
      if (alive) setLast({ id, reference })
    })
    return () => {
      alive = false
    }
  }, [id])
  const reference = tablesOf(id)
  return reference ? { id, reference } : last
}
