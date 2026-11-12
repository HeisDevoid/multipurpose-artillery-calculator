import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'

import { t } from '../i18n'
import { useFeature } from '../lib/features'
import { playSound } from '../lib/sound'
import { shellKind } from '../lib/shellKind'
import { useTimerSound } from '../lib/timerSound'
import type { ArtilleryCategory } from '../types/gameModel'
import { FieldIcon } from './FieldIcon'
import { FlightCanvas, type FlightShot } from './FlightCanvas'

/** Controlling the timer from outside (hotkeys). */
export interface FireTimerHandle {
  fire: () => void
  // A shot from another device (Link): a countdown without sending it again
  remoteFire: () => void
  stop: () => void
}

interface Props {
  // Time of flight of the current solution, s
  tof: number
  ref?: Ref<FireTimerHandle>
  // A shot here (a button or a key), for example to tell Link
  onFire?: () => void
  // The weapon class and the shell type decide the flight animation
  category?: ArtilleryCategory
  shellType?: string
  // The shells in flight changed (start, volley, burst, stop)
  onShotChange?: (shots: FlightShot[]) => void
  // bar: the Fire button at the top of the page: the flight line appears only in flight;
  // full: the combat screen: the line is always visible
  variant?: 'bar' | 'full'
  // No solution: nothing to fire
  disabled?: boolean
  // The combat screen button next to Fire
  onCombat?: () => void
}

// How many seconds before impact to warn ("splash"),
// as is the custom when reporting to an observer.
const SPLASH_WARNING_S = 5
// How long to show "Impact" after the shell lands
const IMPACT_HOLD_MS = 4000

interface Shot extends FlightShot {
  id: number
}

/**
 * The "fire → impact" timer: a countdown by time of flight, a signal 5 s before
 * impact and at impact. The timer line is also the flight animation.
 * With "volley" on, a "+ shell" button appears in flight: one more
 * shell flies next to the previous ones, and it shows when each lands.
 */
export function FireTimer({
  tof,
  ref,
  onFire,
  category = 'mortar',
  shellType = 'HE',
  onShotChange,
  variant = 'full',
  disabled = false,
  onCombat,
}: Props) {
  const [shots, setShots] = useState<Shot[]>([])
  const [now, setNow] = useState(() => Date.now())
  const sound = useTimerSound()
  const volley = useFeature('volley')
  const nextId = useRef(1)
  // Short marks for the animations: the button recoil and the "wave" at impact
  const [kicking, setKicking] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const kickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(
    () => () => {
      clearTimeout(kickTimer.current)
      clearTimeout(pulseTimer.current)
    },
    []
  )
  // Which signals have already sounded for which shell
  const signaled = useRef(new Map<number, { splash: boolean; impact: boolean }>())

  const shotChangeRef = useRef(onShotChange)
  useEffect(() => {
    shotChangeRef.current = onShotChange
  })
  useEffect(() => {
    shotChangeRef.current?.(shots)
  }, [shots])

  // Tick while a shell is in flight and a little after impact.
  const active = shots.length > 0
  useEffect(() => {
    if (!active) return

    const interval = window.setInterval(() => {
      const current = Date.now()
      let changed = false
      const kept: Shot[] = []
      for (const shot of shots) {
        const left = shot.tof - (current - shot.firedAt) / 1000
        const flags = signaled.current.get(shot.id) ?? { splash: false, impact: false }
        if (!flags.splash && left <= SPLASH_WARNING_S) {
          flags.splash = true
          if (sound && shot.tof > SPLASH_WARNING_S) playSound('splash')
        }
        if (!flags.impact && left <= 0) {
          flags.impact = true
          if (sound) playSound('impact')
          setPulsing(true)
          clearTimeout(pulseTimer.current)
          pulseTimer.current = setTimeout(() => setPulsing(false), 900)
        }
        signaled.current.set(shot.id, flags)
        if (left * 1000 < -IMPACT_HOLD_MS) {
          changed = true
          signaled.current.delete(shot.id)
        } else {
          kept.push(shot)
        }
      }
      if (changed) setShots(kept)
      setNow(current)
    }, 100)

    return () => window.clearInterval(interval)
  }, [active, shots, sound])

  useImperativeHandle(ref, () => ({
    fire,
    remoteFire: () => start(false),
    stop: () => setShots([]),
  }))

  function fire() {
    if (disabled) return
    start(false)
    onFire?.()
  }

  // append: add to the ones in flight (a volley), otherwise start over
  function start(append: boolean) {
    const firedAt = Date.now()
    const shot: Shot = { id: nextId.current++, firedAt, tof }
    signaled.current = append ? signaled.current : new Map()
    setNow(firedAt)
    setShots((list) => (append ? [...list, shot] : [shot]))
    setKicking(true)
    clearTimeout(kickTimer.current)
    kickTimer.current = setTimeout(() => setKicking(false), 450)
    // A short click confirms the press and unlocks sound
    // in the browser (AudioContext starts only after a gesture).
    if (sound) playSound('fire')
  }

  // The nearest impact (or the last one, if all have landed)
  const lefts = shots.map((s) => s.tof - (now - s.firedAt) / 1000)
  const pending = lefts.filter((l) => l > 0)
  const left = shots.length === 0 ? null : pending.length > 0 ? Math.min(...pending) : Math.max(...lefts)

  const phase =
    left === null
      ? 'idle'
      : left <= 0
        ? 'impact'
        : left <= SPLASH_WARNING_S
          ? 'splash'
          : 'flight'

  const alert = phase === 'splash' || phase === 'impact'
  const phaseLabel = {
    idle: t('fireTimer.ready'),
    flight: t('fireTimer.in-flight'),
    splash: t('fireTimer.splash'),
    impact: t('fireTimer.impact'),
  }[phase]

  const bar = variant === 'bar'
  const showStatus = !bar || active

  return (
    <div
      className={[
        bar ? 'rounded-lg' : 'mt-4 rounded-lg bg-app-surface p-3',
        pulsing ? 'impact-pulse' : '',
      ].join(' ')}
    >
      <div className="flex gap-2">
        <button
          type="button"
          data-tour="fire"
          disabled={disabled}
          onClick={fire}
          className={`btn btn-primary btn-lg flex-1 ${kicking ? 'fire-kick' : ''}`}
        >
          <FieldIcon name="fire" className="h-5 w-5" />
          {active ? t('fireTimer.fire-again') : t('fireTimer.fire')}
          <span className="hidden rounded bg-white/20 px-1.5 text-[12px] font-medium sm:inline">
            F
          </span>
        </button>

        {volley && active && (
          <button
            type="button"
            onClick={() => start(true)}
            title={t('fireTimer.add-shell-title')}
            className="btn min-h-12"
          >
            <FieldIcon name="plus" className="h-4 w-4" />
            {t('fireTimer.add-shell')}
          </button>
        )}

        {active && (
          <button
            type="button"
            onClick={() => setShots([])}
            className="btn min-h-12"
          >
            <FieldIcon name="stop" className="h-4 w-4" />
            {t('fireTimer.stop')}
          </button>
        )}

        {onCombat && (
          <button
            type="button"
            disabled={disabled}
            onClick={onCombat}
            title={`${t('artilleryCalculator.combat-screen')} (B)`}
            aria-label={t('artilleryCalculator.combat-screen')}
            className="btn min-h-12 w-12 shrink-0 px-0"
          >
            <FieldIcon name="combat" className="h-6 w-6" />
          </button>
        )}
      </div>

      {showStatus && (
        <div className="mt-3" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <span className={['label', alert ? 'text-danger' : ''].join(' ')}>
              {phaseLabel}
              {shots.length > 1 && ` · ×${shots.length}`}
              {phase === 'idle' &&
                ` · ${t('fireTimer.beep-at')} ${SPLASH_WARNING_S} ${t('unit.s')}`}
            </span>
            <span
              className={[
                'text-xl font-semibold tabular-nums',
                alert ? 'text-danger' : 'text-app-text',
              ].join(' ')}
            >
              <span className={pulsing && phase === 'impact' ? 'impact-jump' : ''}>
                {left === null
                  ? tof.toFixed(1)
                  : phase === 'impact'
                    ? '0.0'
                    : left.toFixed(1)}
              </span>
              <span className="ml-1 text-[13px] font-normal text-app-muted">
                {t('unit.s')}
              </span>
            </span>
          </div>
          {/* The timer line: the shell flies along it, and it shows the progress */}
          <FlightCanvas
            shots={shots}
            category={category}
            kind={shellKind(shellType)}
            alert={alert}
            idle={!bar}
            className="mt-1 block"
          />
        </div>
      )}
    </div>
  )
}
