import { t } from '../i18n'
import { useSyncExternalStore } from 'react'

/**
 * Map markers: placed in the app or recognised from a screenshot of the
 * game map; over Link they go to everyone in the room.
 */

export type PresetColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'black'

// A ready Arma colour or any custom one, "#rrggbb" (the hue wheel)
export type MarkerColor = PresetColor | `#${string}`

export const MARKER_COLORS: readonly PresetColor[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'black',
]

// Colours as for Arma markers (ColorRed, ColorBlue…)
export const MARKER_RGB: Record<PresetColor, string> = {
  red: '#e60000',
  orange: '#d96600',
  yellow: '#d9d900',
  green: '#00cc00',
  blue: '#0000ff',
  purple: '#b000b0',
  black: '#000000',
}

/** This is a valid marker colour: a ready one or "#rrggbb". */
export function isMarkerColor(value: unknown): value is MarkerColor {
  return (
    typeof value === 'string' &&
    ((MARKER_COLORS as readonly string[]).includes(value) || /^#[0-9a-fA-F]{6}$/.test(value))
  )
}

/** The CSS colour of a marker. */
export function markerRgb(color: MarkerColor): string {
  return color.startsWith('#') ? color : MARKER_RGB[color as PresetColor]
}

export interface MapMarker {
  id: string
  // The map (worldName); '' means unknown (placed by a coordinate)
  world: string
  // Metres from the grid origin: east, north
  x: number
  y: number
  label: string
  color: MarkerColor
  // When the marker appeared, ms
  createdAt: number
  // The call sign or the role of the one who placed it
  author: string
  // The owner device: only it changes and removes the marker
  owner: string
  // Where it came from: placed by hand or found on a map screenshot
  source: 'app' | 'screen'
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isString = (value: unknown): value is string => typeof value === 'string'

/** Validation of a marker from storage or Link. */
export function parseMarker(value: unknown): MapMarker | null {
  if (typeof value !== 'object' || value === null) return null
  const m = value as Record<string, unknown>
  if (
    !isString(m.id) ||
    m.id.length === 0 ||
    m.id.length > 64 ||
    !isString(m.world) ||
    !isNumber(m.x) ||
    !isNumber(m.y) ||
    !isString(m.label) ||
    !isMarkerColor(m.color) ||
    !isNumber(m.createdAt) ||
    !isString(m.author) ||
    !isString(m.owner) ||
    (m.source !== 'app' && m.source !== 'screen')
  ) {
    return null
  }
  return {
    id: m.id,
    world: m.world.slice(0, 64),
    x: m.x,
    y: m.y,
    label: m.label.slice(0, 40),
    color: m.color,
    createdAt: m.createdAt,
    author: m.author.slice(0, 24),
    owner: m.owner,
    source: m.source,
  }
}

/** "2 min", "1 h 5 min": how old the marker is. */
export function formatAge(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return t('markers.just-now')
  if (minutes < 60) return t('markers.min', minutes)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? t('markers.h-min', hours, rest) : t('markers.h', hours)
}

/** How "fresh" the marker is: 1 is new, by 30 minutes it fades to 0.35. */
export function markerOpacity(ageMs: number): number {
  const fade = Math.min(1, Math.max(0, ageMs / (30 * 60_000)))
  return 1 - fade * 0.65
}

// ---- storage ----

const STORAGE_KEY = 'mapMarkers'
// Older ones are not loaded: past games are not needed
const MAX_AGE_MS = 12 * 60 * 60_000

function newId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
}

/** A permanent device number: the owner of its markers. */
export const deviceId: string = (() => {
  try {
    const stored = localStorage.getItem('deviceId')
    if (stored) return stored
    const id = newId()
    localStorage.setItem('deviceId', id)
    return id
  } catch {
    return newId()
  }
})()

function load(): MapMarker[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    const now = Date.now()
    return raw
      .map(parseMarker)
      .filter(
        (m): m is MapMarker => m !== null && now - m.createdAt < MAX_AGE_MS
      )
  } catch {
    return []
  }
}

let markers: MapMarker[] = typeof window === 'undefined' ? [] : load()
const listeners = new Set<() => void>()

export type MarkerChange =
  | { type: 'upsert'; marker: MapMarker }
  | { type: 'remove'; id: string }

const localListeners = new Set<(change: MarkerChange) => void>()

function commit(next: MapMarker[]) {
  markers = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(markers))
  } catch {
    // Storage is unavailable: the markers live until a reload.
  }
  listeners.forEach((listener) => listener())
}

export function getMarkers(): MapMarker[] {
  return markers
}

export function subscribeMarkers(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useMarkers(): MapMarker[] {
  return useSyncExternalStore(subscribeMarkers, getMarkers, getMarkers)
}

/** Changes on this device: Link sends them to the others. */
export function onLocalMarkerChange(listener: (change: MarkerChange) => void) {
  localListeners.add(listener)
  return () => {
    localListeners.delete(listener)
  }
}

function apply(change: MarkerChange) {
  if (change.type === 'upsert') {
    const rest = markers.filter((m) => m.id !== change.marker.id)
    commit([...rest, change.marker])
  } else if (markers.some((m) => m.id === change.id)) {
    commit(markers.filter((m) => m.id !== change.id))
  }
}

function local(change: MarkerChange) {
  apply(change)
  localListeners.forEach((listener) => listener(change))
}

export type NewMarker = Pick<
  MapMarker,
  'world' | 'x' | 'y' | 'label' | 'color' | 'author' | 'source'
>

export function addMarker(input: NewMarker, createdAt = Date.now()): MapMarker {
  const marker: MapMarker = { ...input, id: newId(), createdAt, owner: deviceId }
  local({ type: 'upsert', marker })
  return marker
}

export function updateMarker(id: string, patch: Partial<Pick<MapMarker, 'label' | 'color' | 'x' | 'y'>>) {
  const current = markers.find((m) => m.id === id)
  if (!current) return
  local({ type: 'upsert', marker: { ...current, ...patch } })
}

export function removeMarker(id: string) {
  local({ type: 'remove', id })
}

/** A marker or a removal came over Link: it is not sent back. */
export function applyRemoteMarker(change: MarkerChange) {
  if (change.type === 'upsert') {
    const current = markers.find((m) => m.id === change.marker.id)
    // Edits of own markers by others are not accepted
    if (current && current.owner === deviceId) return
    if (change.marker.owner === deviceId && !current) return
  }
  apply(change)
}

/** Own markers: send them again after connecting. */
export function ownMarkers(): MapMarker[] {
  return markers.filter((m) => m.owner === deviceId)
}

// ---- merging with a screenshot ----

export interface DetectedMarker {
  x: number
  y: number
  color: MarkerColor
}

export interface ScreenMergePlan {
  add: DetectedMarker[]
  remove: string[]
}

/**
 * A new map image against the markers found earlier:
 * the ones matching in colour and place stay (and keep their age),
 * new ones are added, and the ones gone from the visible area are removed
 * (the marker was erased in the game).
 */
export function planScreenMerge(
  existing: readonly MapMarker[],
  detected: readonly DetectedMarker[],
  visible: { minX: number; maxX: number; minY: number; maxY: number },
  radius: number
): ScreenMergePlan {
  const candidates = existing.filter((m) => m.source === 'screen')
  const matched = new Set<string>()
  const add: DetectedMarker[] = []

  for (const found of detected) {
    let best: MapMarker | null = null
    let bestDistance = radius
    for (const marker of candidates) {
      if (marker.color !== found.color || matched.has(marker.id)) continue
      const distance = Math.hypot(marker.x - found.x, marker.y - found.y)
      if (distance <= bestDistance) {
        best = marker
        bestDistance = distance
      }
    }
    if (best) matched.add(best.id)
    else add.push(found)
  }

  const remove = candidates
    .filter(
      (m) =>
        !matched.has(m.id) &&
        m.x >= visible.minX &&
        m.x <= visible.maxX &&
        m.y >= visible.minY &&
        m.y <= visible.maxY
    )
    .map((m) => m.id)

  return { add, remove }
}
