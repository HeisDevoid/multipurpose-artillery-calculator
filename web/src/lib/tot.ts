/**
 * Time on target (TOT): the moment of impact is set, and the
 * shot is fired at "impact − time of flight". The time follows the device
 * clock (phones and PCs sync it over the network).
 */

const SECOND = 1000
const MINUTE = 60 * SECOND
const DAY = 24 * 60 * MINUTE

/** The moment of the shot for an impact at impactAt, ms. */
export function fireMoment(impactAt: number, tofS: number): number {
  return impactAt - tofS * SECOND
}

/**
 * The nearest "round" impact time: no earlier than leadS seconds
 * to get ready plus the time of flight, a multiple of stepS seconds.
 */
export function suggestImpactTime(
  now: number,
  tofS: number,
  leadS = 30,
  stepS = 10
): number {
  const earliest = now + (leadS + tofS) * SECOND
  const step = stepS * SECOND
  return Math.ceil(earliest / step) * step
}

/**
 * The impact time from a string "18:30", "18:30:15" or "183015"
 * (the device clock). The nearest such time: if today it passed
 * more than five minutes ago, it is tomorrow. null: not a time.
 */
export function parseClock(text: string, now: number): number | null {
  const trimmed = text.trim()
  let parts: number[]
  if (/^\d{4}$|^\d{6}$/.test(trimmed)) {
    parts = trimmed.match(/\d{2}/g)!.map(Number)
  } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    parts = trimmed.split(':').map(Number)
  } else {
    return null
  }
  const [hours, minutes, seconds = 0] = parts
  if (hours > 23 || minutes > 59 || seconds > 59) return null

  const date = new Date(now)
  date.setHours(hours, minutes, seconds, 0)
  let at = date.getTime()
  if (at < now - 5 * MINUTE) at += DAY
  return at
}

const pad = (value: number) => String(value).padStart(2, '0')

/** "18:30:05" by the device clock. */
export function formatClock(ms: number): string {
  const date = new Date(ms)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** "18:29:41.2": the moment of the shot with tenths. */
export function formatClockTenths(ms: number): string {
  const tenths = Math.floor((((ms % SECOND) + SECOND) % SECOND) / 100)
  return `${formatClock(ms)}.${tenths}`
}
