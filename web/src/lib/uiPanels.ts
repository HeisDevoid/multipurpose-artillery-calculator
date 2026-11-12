import { useSyncExternalStore } from 'react'

/**
 * Windows that open from the footer and with hotkeys:
 * the key help and the tutorial. The state is shared by the whole app.
 */
export type PanelId = 'hotkeys' | 'tour' | 'tourAdvanced' | 'help' | 'physics'

const open = new Set<PanelId>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  listeners.forEach((listener) => listener())
}

export function setPanel(id: PanelId, value: boolean) {
  if (value === open.has(id)) return
  if (value) open.add(id)
  else open.delete(id)
  emit()
}

export function togglePanel(id: PanelId) {
  setPanel(id, !open.has(id))
}

export function usePanel(id: PanelId): boolean {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => version,
    () => 0
  )
  return open.has(id)
}

// ---- the tutorial: whether to show it on the first start ----

const TOUR_KEY = 'tourDone'

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === 'yes'
  } catch {
    return true
  }
}

export function markTourDone() {
  try {
    localStorage.setItem(TOUR_KEY, 'yes')
  } catch {
    // Storage is unavailable: the tutorial will show again.
  }
}

const ADVANCED_KEY = 'tourAdvancedDone'

export function advancedTourDone(): boolean {
  try {
    return localStorage.getItem(ADVANCED_KEY) === 'yes'
  } catch {
    return true
  }
}

export function markAdvancedTourDone() {
  try {
    localStorage.setItem(ADVANCED_KEY, 'yes')
  } catch {
    // Storage is unavailable: the offer will show again.
  }
}

// ---- the server physics: ask once (before the tutorial) ----

const PHYSICS_KEY = 'physicsAsked'

export function physicsAsked(): boolean {
  try {
    return localStorage.getItem(PHYSICS_KEY) === 'yes'
  } catch {
    return true
  }
}

export function markPhysicsAsked() {
  try {
    localStorage.setItem(PHYSICS_KEY, 'yes')
  } catch {
    // Storage is unavailable: the question will appear again.
  }
}
