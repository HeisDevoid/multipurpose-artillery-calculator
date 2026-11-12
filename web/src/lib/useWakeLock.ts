import { useEffect } from 'react'

export const wakeLockSupported =
  typeof navigator !== 'undefined' && 'wakeLock' in navigator

/**
 * Keeps the screen from going dark while active = true.
 * The browser releases the lock when the tab is hidden, so it is
 * requested again on return.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !wakeLockSupported) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function request() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // A refusal (power saving, no user gesture) is not critical.
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release()
    }
  }, [active])
}
