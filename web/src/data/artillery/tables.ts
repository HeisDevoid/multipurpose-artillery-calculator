import { useEffect, useState } from 'react'

import { isModelId, type ModelId } from '../models'
import tableStatus from '../tableStatus.json'
import type { ArtilleryReference, DataStatus } from '../../types/artillery'
import { parseReference } from './parse'

/**
 * Таблицы стрельбы в приложении: у каждого орудия свой файл сборки, он
 * грузится, когда орудие выбрано (выбранное — до первой отрисовки),
 * остальные — в фоне, чтобы сайт работал и без интернета.
 */

// Какой JSON-справочник у какого орудия
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

/** Таблицы орудия, если уже загружены. */
export function tablesOf(id: ModelId): ArtilleryReference | undefined {
  return loaded.get(id)
}

/** Загрузить таблицы орудия (повторный вызов ждёт ту же загрузку). */
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

/** Все таблицы — в фоне, по одной: потом орудие меняется мгновенно и без сети. */
export async function preloadAllTables() {
  for (const id of Object.keys(TABLE_OF) as ModelId[]) {
    await loadTables(id).catch(() => undefined)
  }
}

/** Проверены ли таблицы в игре: без загрузки самих таблиц. */
export function statusOf(id: ModelId): DataStatus {
  return (tableStatus as Record<string, DataStatus>)[TABLE_OF[id]] ?? 'pending'
}

/** Орудие при открытии: выбранное раньше (как в App), иначе Mk6. */
export function initialModelId(): ModelId {
  try {
    const stored = localStorage.getItem('selectedModel')
    if (stored && isModelId(stored)) return stored
  } catch {
    // Хранилище недоступно.
  }
  return 'mk6'
}

/**
 * Таблицы выбранного орудия. Пока новое орудие грузится, остаются таблицы
 * прежнего (вместе с его id), чтобы экран не мигал.
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
