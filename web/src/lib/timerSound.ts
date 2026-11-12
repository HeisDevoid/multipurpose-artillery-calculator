import { useSyncExternalStore } from 'react'

/** Timer sound signals (click, splash, impact): turned on in the settings. */
const KEY = 'timerSound'
const listeners = new Set<() => void>()
let memory: boolean | undefined

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function getTimerSound(): boolean {
  return memory ?? read()
}

export function setTimerSound(value: boolean) {
  memory = value
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off')
  } catch {
    // Storage is unavailable: the setting lives until a reload.
  }
  listeners.forEach((listener) => listener())
}

export function useTimerSound(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getTimerSound,
    () => true
  )
}
