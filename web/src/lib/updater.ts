import { useSyncExternalStore } from 'react'

import { isDesktop, isOverlayWindow } from './desktop'

/** A new version of the Windows app (GitHub Releases, a signed installer). */
export interface AvailableUpdate {
  version: string
  notes: string | null
  // Download, install and restart; onProgress gets the fraction 0…1 (null if the size is unknown)
  install: (onProgress: (share: number | null) => void) => Promise<void>
}

/**
 * Whether there is an update. Never in a browser or in the overlay window. Errors (no
 * network, no access) are not swallowed: About shows them.
 */
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isDesktop || isOverlayWindow) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null
  return {
    version: update.version,
    notes: update.body ?? null,
    install: async (onProgress) => {
      let total = 0
      let done = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0
        if (event.event === 'Progress') {
          done += event.data.chunkLength
          onProgress(total > 0 ? Math.min(1, done / total) : null)
        }
      })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
  }
}

export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'available'; update: AvailableUpdate }
  | { kind: 'error'; message: string }

let status: UpdateStatus = { kind: 'idle' }
let lastCheck = 0
const listeners = new Set<() => void>()

function setStatus(next: UpdateStatus) {
  status = next
  listeners.forEach((listener) => listener())
}

/** The update check state: the banner and About. */
export function useUpdateStatus(): UpdateStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => status
  )
}

/** Check now. A found update is not checked again: the banner is already there. */
export async function runUpdateCheck(): Promise<void> {
  if (!isDesktop || isOverlayWindow) return
  if (status.kind === 'checking' || status.kind === 'available') return
  lastCheck = Date.now()
  setStatus({ kind: 'checking' })
  try {
    const update = await checkForUpdate()
    setStatus(update ? { kind: 'available', update } : { kind: 'latest' })
  } catch (error) {
    setStatus({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

// The app may run for hours: a new version is looked for while it runs too
const INTERVAL = 30 * 60 * 1000

/**
 * Checks: a few seconds after the start (so as not to slow it down), then
 * every half an hour, when the window gets focus back (if the last check was long ago) and on
 * a second launch of the app (it opens the window that is already running).
 */
export function startUpdateChecks(): () => void {
  if (!isDesktop || isOverlayWindow) return () => {}
  const first = window.setTimeout(() => void runUpdateCheck(), 4000)
  const timer = window.setInterval(() => void runUpdateCheck(), INTERVAL)
  const onFocus = () => {
    if (Date.now() - lastCheck > INTERVAL) void runUpdateCheck()
  }
  window.addEventListener('focus', onFocus)
  let unlisten: (() => void) | null = null
  let stopped = false
  void import('@tauri-apps/api/event').then(({ listen }) =>
    listen('second-instance', () => void runUpdateCheck()).then((stop) => {
      if (stopped) stop()
      else unlisten = stop
    })
  )
  return () => {
    stopped = true
    window.clearTimeout(first)
    window.clearInterval(timer)
    window.removeEventListener('focus', onFocus)
    unlisten?.()
  }
}
