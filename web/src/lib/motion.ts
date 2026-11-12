import { useSyncExternalStore } from 'react'

/**
 * Interface animations by kind, each turned on separately in the settings:
 *   numbers:  the "rolling" solution numbers and their short flash;
 *   switches: the sliding "pill" of the toggles;
 *   appear:   windows, banners and cards appearing;
 *   smooth:   smooth transitions: hover, a choice change, expanding;
 *   fire:     the recoil on pressing Fire and the muzzle flash;
 *   impact:   the timer highlight and "jump" when the shell lands.
 * The tutorial glide and the theme change circle are built in and always on.
 * By default everything is on unless "reduce motion" is chosen in the system.
 * The choice is marked on <html> (data-m-<kind>), and CSS turns the animations off by it.
 */
export type MotionKind =
  | 'numbers'
  | 'switches'
  | 'appear'
  | 'smooth'
  | 'fire'
  | 'impact'

export const MOTION_KINDS: readonly MotionKind[] = [
  'numbers',
  'switches',
  'appear',
  'smooth',
  'fire',
  'impact',
]

const listeners = new Set<() => void>()
const memory: Partial<Record<MotionKind, boolean>> = {}

const storageKey = (kind: MotionKind) => `motion:${kind}`

function systemReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function read(kind: MotionKind): boolean {
  try {
    const value = localStorage.getItem(storageKey(kind))
    if (value === 'on') return true
    if (value === 'off') return false
  } catch {
    // Storage is unavailable: the system setting is used
  }
  return !systemReduced()
}

export function getMotion(kind: MotionKind): boolean {
  return memory[kind] ?? read(kind)
}

/** Mark the choice on <html>: CSS turns the animations off by it. */
export function applyMotion() {
  if (typeof document === 'undefined') return
  for (const kind of MOTION_KINDS) {
    document.documentElement.setAttribute(
      `data-m-${kind}`,
      getMotion(kind) ? 'on' : 'off'
    )
  }
}

export function setMotion(kind: MotionKind, value: boolean) {
  memory[kind] = value
  try {
    localStorage.setItem(storageKey(kind), value ? 'on' : 'off')
  } catch {
    // The setting lives until a reload.
  }
  applyMotion()
  listeners.forEach((listener) => listener())
}

export function useMotion(kind: MotionKind): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => getMotion(kind),
    () => true
  )
}
