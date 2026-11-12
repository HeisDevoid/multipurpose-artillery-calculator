import { useSyncExternalStore } from 'react'

/**
 * Optional calculator sections: turned on in the settings.
 * Off by default, so that the main screen is not overloaded.
 */
export type FeatureId =
  | 'adjust'
  | 'weather'
  | 'tot'
  | 'journal'
  | 'table'
  // Not a section but hints: tooltips and explanatory notes
  | 'hints'
  // Charges that do not reach the target are not shown
  | 'hideUnfit'
  // The "+ shell" button: one more shell in flight next to the previous one
  | 'volley'
  // Only the charges that are good at something: best, fast, precise
  | 'onlyGood'
  // Simultaneous impact (MRSI): towed and self-propelled guns only
  | 'mrsi'
  // Anonymous usage counter: one request a day, see lib/usage.ts
  | 'usageStats'

const KEY_PREFIX = 'feature:'
const DEFAULT_ON: ReadonlySet<FeatureId> = new Set<FeatureId>(['hints', 'hideUnfit', 'usageStats'])
const listeners = new Set<() => void>()

function read(id: FeatureId): boolean {
  try {
    const value = localStorage.getItem(KEY_PREFIX + id)
    // The hints, the hiding of unfit charges and the usage counter are on until turned off
    return DEFAULT_ON.has(id) ? value !== 'off' : value === 'on'
  } catch {
    return DEFAULT_ON.has(id)
  }
}

const memory = new Map<FeatureId, boolean>()

export function setFeature(id: FeatureId, value: boolean) {
  memory.set(id, value)
  try {
    localStorage.setItem(KEY_PREFIX + id, value ? 'on' : 'off')
  } catch {
    // Storage is unavailable: the setting lives until a reload.
  }
  listeners.forEach((listener) => listener())
}

function snapshot(id: FeatureId): boolean {
  return memory.get(id) ?? read(id)
}

/** The current value of a setting, for code outside React. */
export function isFeatureOn(id: FeatureId): boolean {
  return snapshot(id)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether an optional section is on. */
export function useFeature(id: FeatureId): boolean {
  return useSyncExternalStore(
    subscribe,
    () => snapshot(id),
    () => DEFAULT_ON.has(id)
  )
}
