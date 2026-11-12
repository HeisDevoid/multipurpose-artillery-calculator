import { useState } from 'react'

import type { ArtilleryMode } from '../types/artillery'

const STORAGE_KEY = 'artilleryJournal'

export type AngleUnit = 'mil' | 'deg'
export type WindMode = 'vector' | 'components'

/** Weather inputs (as the user entered them). */
export interface JournalWeather {
  windMode: WindMode
  // The vector mode: speed, m/s, and the direction it blows from, °
  windSpeed: number | null
  windFrom: number | null
  // The components mode: head (+) / tail (−) and cross
  // from the right (+) / from the left (−), m/s
  headwind: number | null
  crosswind: number | null
  temperature: number | null // °C
  pressure: number | null // hPa
}

/**
 * A journal entry: the saved inputs and the result at the moment of saving.
 * The entry belongs to the calendar day (dayKey) when it was created.
 */
export interface JournalEntry {
  id: string
  name: string

  createdAt: string // ISO creation time
  dayKey: string // YYYY-MM-DD, the local creation date

  modelId: string
  ammoId: string
  charge: number

  distance: number
  ownHeight: number | null
  targetHeight: number | null
  rangeCorrection: number

  // A snapshot of the result
  elevation: number
  tof: number

  // v0.7 fields, missing in old entries.
  // The azimuth to the target and the wind-corrected azimuth, in azimuthUnit units.
  azimuth?: number | null
  azimuthUnit?: AngleUnit
  firingAzimuth?: number | null
  weather?: JournalWeather | null

  // A v0.8 field: the lateral correction, m (> 0 to the right)
  lateralCorrection?: number

  // A v0.10 field: the table mode; missing means HIGH
  mode?: ArtilleryMode

  // A v0.12 field: the target point on the map, if the target was placed on the map
  target?: MapTarget | null
}

/** A target on the map: the world (worldName) and metres from the grid origin. */
export interface MapTarget {
  world: string
  x: number
  y: number
}

export type JournalDraft = Omit<
  JournalEntry,
  'id' | 'createdAt' | 'dayKey'
>

export interface JournalDay {
  dayKey: string
  entries: JournalEntry[]
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberOrNull(value: unknown): boolean {
  return value === null || isNumber(value)
}

function isOptionalNumber(value: unknown): boolean {
  return value === undefined || isNumberOrNull(value)
}

function isWeather(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object') return false
  const v = value as Record<string, unknown>

  return (
    (v.windMode === 'vector' || v.windMode === 'components') &&
    isNumberOrNull(v.windSpeed) &&
    isNumberOrNull(v.windFrom) &&
    isNumberOrNull(v.headwind) &&
    isNumberOrNull(v.crosswind) &&
    isNumberOrNull(v.temperature) &&
    isNumberOrNull(v.pressure)
  )
}

function isMapTarget(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.world === 'string' && isNumber(v.x) && isNumber(v.y)
}

function isEntry(value: unknown): value is JournalEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.createdAt === 'string' &&
    typeof v.dayKey === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.dayKey) &&
    typeof v.modelId === 'string' &&
    typeof v.ammoId === 'string' &&
    isNumber(v.charge) &&
    isNumber(v.distance) &&
    isNumberOrNull(v.ownHeight) &&
    isNumberOrNull(v.targetHeight) &&
    isNumber(v.rangeCorrection) &&
    isNumber(v.elevation) &&
    isNumber(v.tof) &&
    isOptionalNumber(v.azimuth) &&
    (v.azimuthUnit === undefined ||
      v.azimuthUnit === 'mil' ||
      v.azimuthUnit === 'deg') &&
    isOptionalNumber(v.firingAzimuth) &&
    (v.lateralCorrection === undefined || isNumber(v.lateralCorrection)) &&
    (v.mode === undefined || v.mode === 'HIGH' || v.mode === 'LOW') &&
    isWeather(v.weather) &&
    isMapTarget(v.target)
  )
}

export function loadEntries(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Damaged entries are dropped, the rest are saved.
    return parsed.filter(isEntry)
  } catch {
    return []
  }
}

// ---- moving the journal between devices ----

const EXPORT_APP = 'multipurpose-artillery-calculator'
const EXPORT_VERSION = 1

/** The export file: a wrapper with the app mark and the format version. */
export function exportJournal(
  entries: readonly JournalEntry[],
  now = new Date()
): string {
  return JSON.stringify(
    {
      app: EXPORT_APP,
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      entries,
    },
    null,
    2
  )
}

/**
 * Parsing a journal file. Accepts an export file or a bare array
 * of entries. Returns the valid entries (damaged ones are dropped)
 * and the number dropped; null: the file does not look like a journal.
 */
export function parseJournalFile(
  text: string
): { entries: JournalEntry[]; invalid: number } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  const list =
    Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' &&
          parsed !== null &&
          (parsed as { app?: unknown }).app === EXPORT_APP &&
          Array.isArray((parsed as { entries?: unknown }).entries)
        ? (parsed as { entries: unknown[] }).entries
        : null

  if (list === null) return null

  const entries = list.filter(isEntry)
  return { entries, invalid: list.length - entries.length }
}

/** Add new entries; entries with an existing id are skipped. */
export function mergeEntries(
  existing: readonly JournalEntry[],
  incoming: readonly JournalEntry[]
): { entries: JournalEntry[]; added: number; skipped: number } {
  const ids = new Set(existing.map((e) => e.id))
  const fresh: JournalEntry[] = []

  for (const entry of incoming) {
    if (ids.has(entry.id)) continue
    ids.add(entry.id)
    fresh.push(entry)
  }

  return {
    entries: [...existing, ...fresh],
    added: fresh.length,
    skipped: incoming.length - fresh.length,
  }
}

/** How many recent targets go into the strip and the key switching */
export const RECENT_TARGETS = 10

/** The recent targets, newest first (the target strip and switching). */
export function recentEntries(
  entries: readonly JournalEntry[],
  limit = RECENT_TARGETS
): JournalEntry[] {
  return [...entries]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}

/**
 * The neighbouring target in the recent list: direction 1 is the next one (older),
 * −1 the previous one. Without a current one, the newest.
 */
export function neighbourEntry(
  list: readonly JournalEntry[],
  currentId: string | null,
  direction: 1 | -1
): JournalEntry | undefined {
  if (list.length === 0) return undefined
  const index = list.findIndex((e) => e.id === currentId)
  if (index === -1) return list[0]
  return list[(index + direction + list.length) % list.length]
}

/** Search by name, model and distance (case-insensitive). */
export function matchesQuery(
  entry: JournalEntry,
  query: string,
  modelName = ''
): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return [entry.name, modelName, String(entry.distance)]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

function saveEntries(entries: JournalEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Storage is unavailable or full: the journal lives until a reload.
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`
}

/** 2026-09-13 → 13.09.2026 */
export function formatDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-')
  return `${day}.${month}.${year}`
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Grouping by day: the newest days on top, the newest entries on top within a day. */
export function groupByDay(
  entries: readonly JournalEntry[]
): JournalDay[] {
  const map = new Map<string, JournalEntry[]>()

  for (const entry of entries) {
    const list = map.get(entry.dayKey) ?? []
    list.push(entry)
    map.set(entry.dayKey, list)
  }

  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dayKey, list]) => ({
      dayKey,
      entries: [...list].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1
      ),
    }))
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>(loadEntries)

  function commit(next: JournalEntry[]) {
    setEntries(next)
    saveEntries(next)
  }

  function add(draft: JournalDraft): JournalEntry {
    const now = new Date()
    const entry: JournalEntry = {
      ...draft,
      id: makeId(),
      createdAt: now.toISOString(),
      dayKey: dayKeyOf(now),
    }
    commit([entry, ...entries])
    return entry
  }

  /** Overwrite the inputs and the result of an entry, keeping its id and day. */
  function update(id: string, draft: JournalDraft) {
    commit(
      entries.map((e) =>
        e.id === id
          ? { ...draft, id: e.id, createdAt: e.createdAt, dayKey: e.dayKey }
          : e
      )
    )
  }

  /** Import: returns how many entries were added and skipped. */
  function importEntries(incoming: readonly JournalEntry[]) {
    const result = mergeEntries(entries, incoming)
    if (result.added > 0) commit(result.entries)
    return { added: result.added, skipped: result.skipped }
  }

  function rename(id: string, name: string) {
    const trimmed = name.trim()
    if (trimmed === '') return
    commit(
      entries.map((e) => (e.id === id ? { ...e, name: trimmed } : e))
    )
  }

  function remove(id: string) {
    commit(entries.filter((e) => e.id !== id))
  }

  function clearDay(dayKey: string) {
    commit(entries.filter((e) => e.dayKey !== dayKey))
  }

  return { entries, add, update, importEntries, rename, remove, clearDay }
}
