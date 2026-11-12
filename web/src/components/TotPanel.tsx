import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { useEffect, useRef, useState } from 'react'

import { playSound } from '../lib/sound'
import {
  fireMoment,
  formatClock,
  formatClockTenths,
  parseClock,
  suggestImpactTime,
} from '../lib/tot'
import { ProgressBar } from './FormControls'

// A countdown with sound this many seconds before the shot
const COUNTDOWN_S = 5
// How long to show "Fire!" after the moment of the shot
const HOLD_MS = 3000

interface Props {
  tof: number
  // The impact time, ms; null: not set
  impactAt: number | null
  // No: the time came from fire direction and is not changed here
  onImpactChange?: (impactAt: number | null) => void
  // The moment of the shot has come: start the flight timer
  onFireMoment: () => void
  // The block look: a standalone panel by default
  className?: string
}

/**
 * Time on target (TOT): impact at a set time. The shot comes one time of flight
 * before it, with a countdown and sound; gunners get the time over Link.
 */
export function TotPanel({
  tof,
  impactAt,
  onImpactChange,
  onFireMoment,
  className = 'panel p-4 sm:p-5',
}: Props) {
  const editable = onImpactChange !== undefined
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const signaled = useRef(new Set<string>())
  const fireRef = useRef(onFireMoment)
  useEffect(() => {
    fireRef.current = onFireMoment
  })

  const fireAt = impactAt === null ? null : fireMoment(impactAt, tof)

  // The countdown: ticks 10 times a second, sound in the last seconds
  useEffect(() => {
    if (fireAt === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      const left = (fireAt - current) / 1000
      for (let second = COUNTDOWN_S; second >= 1; second -= 1) {
        const key = `${fireAt}:${second}`
        if (left <= second && left > 0 && !signaled.current.has(key)) {
          signaled.current.add(key)
          playSound('mrsiTick')
        }
      }
      const key = `${fireAt}:fire`
      if (left <= 0 && left > -1 && !signaled.current.has(key)) {
        signaled.current.add(key)
        playSound('mrsiFire')
        fireRef.current()
      }
      // After "Fire!" there is no need to tick
      if (current - fireAt > HOLD_MS + 1000) window.clearInterval(interval)
    }, 100)
    return () => window.clearInterval(interval)
  }, [fireAt])

  function setImpact(at: number | null) {
    onImpactChange?.(at)
    setDraft(at === null ? '' : formatClock(at))
  }

  const draftAt = parseClock(draft, now)
  const left = fireAt === null ? null : (fireAt - now) / 1000
  const phase =
    left === null
      ? 'idle'
      : left > COUNTDOWN_S
        ? 'wait'
        : left > 0
          ? 'count'
          : left * 1000 > -HOLD_MS
            ? 'fire'
            : 'past'

  if (!editable && impactAt === null) return null

  return (
    <details
      className={`disclosure ${className}`}
      open={impactAt !== null || undefined}
    >
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="clock" className="h-5 w-5 text-app-muted" />
          {t('totPanel.time-on-target')}
        </span>
        {impactAt !== null && (
          <span className="tag tag-accent">
            {t('totPanel.impact')} {formatClock(impactAt)}
          </span>
        )}
      </summary>

      <p className="mt-3 text-xs text-app-muted">
        {editable
          ? t('totPanel.set-the-impact-time-the')
          : t('totPanel.the-fdc-set-the-impact')}
      </p>

      {editable && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="label mb-1 block">
              {t('featurePreview.impact-at')}
            </span>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && draftAt !== null) setImpact(draftAt)
              }}
              placeholder="18:30:00"
              inputMode="numeric"
              aria-invalid={draft !== '' && draftAt === null}
              className="field w-32 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            className="btn btn-sm"
            disabled={draftAt === null}
            onClick={() => setImpact(draftAt)}
          >
            {t('totPanel.set')}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setImpact(suggestImpactTime(Date.now(), tof, 30))}
          >
            +30 {t('unit.s')}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setImpact(suggestImpactTime(Date.now(), tof, 60))}
          >
            +1 {t('totPanel.min')}
          </button>
          {impactAt !== null && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => setImpact(null)}
            >
              {t('totPanel.clear')}
            </button>
          )}
        </div>
      )}

      {fireAt !== null && left !== null && impactAt !== null && (
        <div className="mt-3 border-t border-app-border pt-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={[
                'label',
                phase === 'count' || phase === 'fire' ? 'text-accent' : '',
              ].join(' ')}
            >
              {phase === 'fire'
                ? t('overlayApp.fire')
                : phase === 'past'
                  ? t('totPanel.fire-time-has-passed')
                  : `${t('totPanel.fire-at')} ${formatClockTenths(fireAt)}`}
            </span>
            <span
              className={[
                'mono-num text-2xl',
                phase === 'count' || phase === 'fire'
                  ? 'text-accent'
                  : phase === 'past'
                    ? 'text-app-faint'
                    : 'text-app-text',
              ].join(' ')}
            >
              {phase === 'fire' || phase === 'past'
                ? 'T 0.0'
                : `T−${left.toFixed(1)}`}
            </span>
          </div>
          {/* The last minute before the shot as a scale */}
          <ProgressBar
            progress={1 - Math.min(60, Math.max(0, left)) / 60}
            alert={phase === 'count' || phase === 'fire'}
            className="mt-2"
          />
          <p className="label mt-2 text-app-faint">
            {t('fireTimer.impact')} {formatClock(impactAt)} ·{' '}
            {t('totPanel.flight')} {tof.toFixed(1)} {t('unit.s')}
          </p>
        </div>
      )}
    </details>
  )
}
