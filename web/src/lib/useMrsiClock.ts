import { useEffect, useRef, useState } from 'react'

import type { MrsiShot } from './mrsi'
import { playSound } from './sound'

// Signals before a shot, s
const COUNTDOWN = [3, 2, 1]

/**
 * The simultaneous impact clock: signals before every shot and "fire"
 * (sound), onDone 3 s after the common impact. Returns the current time.
 */
export function useMrsiClock(
  plan: readonly MrsiShot[],
  startedAt: number | null,
  onDone: () => void,
  sound = true
): number {
  const [now, setNow] = useState(() => Date.now())
  // Which signals have already sounded: "shot index:second"
  const signaled = useRef(new Set<string>())
  const impactAt = plan.length > 0 ? plan[0].tof : 0

  // The plan and the callback for the timer without restarting the interval on every render
  const planRef = useRef(plan)
  const doneRef = useRef(onDone)
  useEffect(() => {
    planRef.current = plan
    doneRef.current = onDone
  })

  useEffect(() => {
    signaled.current = new Set()
    if (startedAt === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      const elapsed = (current - startedAt) / 1000

      if (sound) {
        planRef.current.forEach((shot, index) => {
          for (const second of COUNTDOWN) {
            const key = `${index}:${second}`
            if (elapsed >= shot.fireAt - second && !signaled.current.has(key)) {
              signaled.current.add(key)
              if (elapsed < shot.fireAt) playSound('mrsiTick')
            }
          }
          const key = `${index}:fire`
          if (elapsed >= shot.fireAt && !signaled.current.has(key)) {
            signaled.current.add(key)
            playSound('mrsiFire')
          }
        })
      }

      if (elapsed > impactAt + 3) {
        doneRef.current()
        return
      }
      setNow(current)
    }, 100)
    return () => window.clearInterval(interval)
  }, [startedAt, impactAt, sound])

  return now
}
