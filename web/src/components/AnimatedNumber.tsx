import { useEffect, useRef, useState } from 'react'


interface Props {
  // null: no value, a dash is shown
  value: number | null
  // How to show the number (an integer by default)
  format?: (value: number) => string
  // A jump larger than this is not animated (an azimuth through 0 does not spin)
  maxTween?: number
  className?: string
  duration?: number
}

import { getMotion } from '../lib/motion'

const reduced = () => !getMotion('numbers')

/**
 * A number that smoothly rolls to its new value and flashes briefly
 * on a change, so it is clear that the solution was updated.
 */
export function AnimatedNumber({
  value,
  format = (v) => String(Math.round(v)),
  maxTween = Number.POSITIVE_INFINITY,
  className = '',
  duration = 320,
}: Props) {
  const [shown, setShown] = useState<number | null>(value)
  const [pulse, setPulse] = useState(0)
  const shownRef = useRef<number | null>(value)

  useEffect(() => {
    const from = shownRef.current
    if (value === null || from === null || reduced() || Math.abs(value - from) > maxTween) {
      shownRef.current = value
      const frame = requestAnimationFrame(() => {
        setShown(value)
        if (value !== null && value !== from) setPulse((n) => n + 1)
      })
      return () => cancelAnimationFrame(frame)
    }
    if (value === from) return
    const start = performance.now()
    let frame = 0
    const tick = () => {
      // Its own clock, not the rAF timestamp: this does not depend on the environment
      const t = Math.min(1, Math.max(0, (performance.now() - start) / duration))
      const eased = 1 - Math.pow(1 - t, 3)
      const current = from + (value - from) * eased
      shownRef.current = current
      setShown(current)
      if (t < 1) frame = requestAnimationFrame(tick)
      else setPulse((n) => n + 1)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, maxTween, duration])

  return (
    <span key={pulse} className={`${pulse > 0 ? 'num-pop' : ''} ${className}`}>
      {shown === null ? '-' : format(shown)}
    </span>
  )
}
