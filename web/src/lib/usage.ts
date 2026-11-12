import { isDesktop, isOverlayWindow } from './desktop'
import { isFeatureOn } from './features'
import { PUBLIC_SITE_URL } from './sync'

/**
 * Anonymous usage counter without a server. Once a day the app downloads a tiny file from a
 * GitHub release. GitHub counts downloads of release files, and the Stats workflow turns
 * those counters into the chart in the README. The request carries nothing about the user or
 * the device: no identifier, no cookies, no referrer.
 */
const COUNTERS_URL = 'https://github.com/HeisDevoid/multipurpose-artillery-calculator/releases/download/usage/'
const DAY_KEY = 'usageDay'

/** Where the app runs: each place has its own counter. */
export type UsageSource = 'web' | 'desktop'

/** The file whose downloads count this kind of use. */
export const counterUrl = (source: UsageSource) => `${COUNTERS_URL}${source}.txt`

/** Calendar day in UTC: the counters are read once a day at a fixed UTC hour. */
export const usageDay = (now: Date) => now.toISOString().slice(0, 10)

export interface UsageEnv {
  /** null: this copy is not counted (development, tests, a local preview). */
  source: UsageSource | null
  /** The setting "Anonymous statistics". */
  enabled: boolean
  online: boolean
  today: string
  /** The day already counted on this device. */
  counted: string | null
  remember: (day: string) => void
  send: (url: string) => Promise<unknown>
}

/**
 * Count today's use once. Returns true when a request was sent and went through.
 * A failed request is not remembered, so the next start or reconnect tries again.
 */
export async function reportUsage(env: UsageEnv): Promise<boolean> {
  if (!env.source || !env.enabled || !env.online || env.counted === env.today) return false
  try {
    await env.send(counterUrl(env.source))
  } catch {
    return false
  }
  env.remember(env.today)
  return true
}

/** Only the published site and the installed Windows app are counted. */
function currentSource(): UsageSource | null {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'devbuild') return null
  // Automated browsers (end-to-end tests, crawlers that say so) are not people
  if (navigator.webdriver) return null
  if (isDesktop) return isOverlayWindow ? null : 'desktop'
  return window.location.href.startsWith(PUBLIC_SITE_URL) ? 'web' : null
}

function readDay(): string | null {
  try {
    return localStorage.getItem(DAY_KEY)
  } catch {
    return null
  }
}

function currentEnv(): UsageEnv {
  return {
    source: currentSource(),
    enabled: isFeatureOn('usageStats'),
    online: navigator.onLine,
    today: usageDay(new Date()),
    counted: readDay(),
    remember: (day) => {
      try {
        localStorage.setItem(DAY_KEY, day)
      } catch {
        // No storage: the device may be counted again today, nothing else breaks
      }
    },
    // The answer is not needed, only the fact of the request
    send: (url) => fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }),
  }
}

/** Count on start, when the connection comes back and when the app is opened again on a new day. */
export function startUsageCounter() {
  if (!currentSource()) return
  const count = () => void reportUsage(currentEnv())
  count()
  window.addEventListener('online', count)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') count()
  })
}
