import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { useEffect, useRef, useState } from 'react'

import { parseNumber, readStoredText, writeStored } from '../lib/input'
import { planMrsi, type MrsiOption, type MrsiShot } from '../lib/mrsi'
import { useMrsiClock } from '../lib/useMrsiClock'
import { InlineNumber, ProgressBar } from './FormControls'

interface Props {
  options: readonly MrsiOption[]
  // Show the mode at a shot (the model has HIGH and LOW)
  showMode: boolean
  // When the strike started (this device's clock); null: not started. The calculator
  // keeps it: the strike is started both by the fire key and by a shot over Link
  startedAt: number | null
  // The Start button: the calculator starts the strike and tells Link
  onStart: () => void
  // The Stop button and the end of the strike
  onStop: () => void
  // Simultaneous impact is selected (the panel is open, two or more shots):
  // the plan for the overlay and Link; null: not selected
  onPlanChange?: (plan: MrsiShot[] | null) => void
}

const DEFAULT_GAP = 4

/**
 * The simultaneous impact plan: what to do now, the next shot in large type
 * (charge, elevation), a bar until the common impact and a list of all shots
 * (fired ones struck through). Shared by the calculator, the gunner over Link and the overlay.
 */
export function MrsiPlanView({
  plan,
  startedAt,
  now,
  showMode,
  compact = false,
}: {
  plan: readonly MrsiShot[]
  startedAt: number | null
  now: number
  showMode: boolean
  // Overlay: smaller and without padding
  compact?: boolean
}) {
  const unitS = t('unit.s')
  const unitMil = t('unit.mil')
  const impactAt = plan.length > 0 ? plan[0].tof : 0
  const elapsed = startedAt === null ? null : (now - startedAt) / 1000
  const nextIndex = elapsed === null ? 0 : plan.findIndex((shot) => shot.fireAt > elapsed)
  const next = nextIndex >= 0 ? plan[nextIndex] : null

  // The large line: what to do now
  let status: string
  if (elapsed === null) status = `${t('mrsiPanel.impact-after')} ${impactAt.toFixed(1)} ${unitS} ${t('mrsiPanel.from-the-first-round')}`
  else if (next) status = `${t('mrsiPanel.round')} ${nextIndex + 1} ${t('mrsiPanel.in')} ${Math.max(0, next.fireAt - elapsed).toFixed(1)} ${unitS}`
  else if (impactAt - elapsed > 0) status = `${t('mrsiPanel.impact-in')} ${(impactAt - elapsed).toFixed(1)} ${unitS}`
  else status = t('mrsiPanel.impact')

  return (
    <>
      {/* The next shot in large type */}
      <div className={compact ? 'rounded-lg bg-white/8 p-2.5' : 'mt-3 rounded-lg bg-app-raised p-3'}>
        <p className="text-[13px] text-app-muted tabular-nums" aria-live="polite">{status}</p>
        {next && (
          <div className="mt-1 grid grid-cols-2 gap-2 tabular-nums">
            <div>
              <p className="text-[12px] text-app-muted">{t('artilleryCalculator.charge')}</p>
              <p className="text-[22px] leading-tight font-semibold text-app-text">
                {next.charge}
                {showMode && <span className="ml-1.5 text-[13px] font-normal text-app-muted">{next.mode}</span>}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-app-muted">{t('artilleryCalculator.elevation')}</p>
              <p className="text-[22px] leading-tight font-semibold whitespace-nowrap text-app-text">
                {Math.round(next.elevation)}
                <span className="text-[13px] font-normal text-app-muted"> {unitMil}</span>
              </p>
            </div>
          </div>
        )}
        {elapsed !== null && (
          <ProgressBar className="mt-3" progress={impactAt > 0 ? elapsed / impactAt : 1} />
        )}
      </div>

      {/* The plan: when, charge, elevation; fired shots are struck through */}
      <ol className={`${compact ? 'mt-1.5 text-[13px]' : 'mt-2 text-[14px]'} overflow-hidden rounded-lg tabular-nums`}>
        {plan.map((shot, index) => {
          const done = elapsed !== null && elapsed >= shot.fireAt
          const current = index === nextIndex
          return (
            <li
              key={`${shot.mode}-${shot.charge}`}
              className={[
                'grid grid-cols-[1.5rem_1fr_auto_auto] items-center gap-3 border-l-2 px-2.5',
                compact ? 'py-1' : 'py-1.5',
                current ? 'border-l-accent bg-accent-soft text-app-text' : 'border-l-transparent',
                done ? 'text-app-faint line-through' : current ? '' : 'text-app-text-2',
              ].join(' ')}
            >
              <b className={done ? '' : 'text-app-text'}>{index + 1}</b>
              <span>{index === 0 ? t('mrsiPanel.now') : `+${shot.fireAt.toFixed(1)} ${unitS}`}</span>
              <span>
                {t('mrsiPanel.charge')} {shot.charge}
                {showMode && ` ${shot.mode}`}
              </span>
              <span className="text-right font-medium">
                {Math.round(shot.elevation)} {unitMil}
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

/**
 * Simultaneous impact (MRSI): one gun fires on different charges
 * with delays, and all shells land on the target at the same time.
 *
 * On top are the reload time and the time until the common impact, the next shot in large type
 * (charge, elevation, countdown), below is the plan of all shots. While
 * the panel is open, the plan goes to the overlay and to the gunners over Link.
 */
export function MrsiPanel({ options, showMode, startedAt, onStart, onStop, onPlanChange }: Props) {
  const unitS = t('unit.s')

  const [gap, setGap] = useState(
    () => readStoredText('mrsiGap') || String(DEFAULT_GAP)
  )
  // Whether the panel is open: a collapsed panel means the strike is not selected
  const [open, setOpen] = useState(() => readStoredText('mrsiOpen') !== 'off')

  useEffect(() => writeStored('mrsiGap', gap), [gap])
  useEffect(() => writeStored('mrsiOpen', open ? 'on' : 'off'), [open])

  const minGap = Math.max(0, parseNumber(gap) ?? DEFAULT_GAP)
  const plan = planMrsi(options, minGap)
  const now = useMrsiClock(plan, startedAt, onStop)

  // The plan for the overlay and Link: only real changes
  const planJson = JSON.stringify(open && plan.length >= 2 ? plan : null)
  const onPlanRef = useRef(onPlanChange)
  useEffect(() => {
    onPlanRef.current = onPlanChange
  })
  useEffect(() => {
    onPlanRef.current?.(JSON.parse(planJson) as MrsiShot[] | null)
  }, [planJson])
  useEffect(() => () => onPlanRef.current?.(null), [])

  return (
    // Collapses like "Time on target" and "Adjust fire"
    <details
      className="disclosure panel p-4 sm:p-5"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="inline-flex min-w-0 items-center gap-2 text-app-text">
          <FieldIcon name="stack" className="h-5 w-5 shrink-0 text-app-muted" />
          {t('mrsiPanel.simultaneous-impact-mrsi')}
        </span>
        <span className="tag shrink-0">
          {plan.length} {t('mrsiPanel.rounds')}
        </span>
      </summary>

      {/* Reload time: it decides which charges make it into the salvo */}
      <label className="mt-3 flex items-center justify-between gap-3 text-[14px] text-app-text-2">
        <span className="flex items-center gap-2">
          <FieldIcon name="reload" className="h-[18px] w-[18px] text-app-muted" />
          {t('mrsiPanel.reload')}
        </span>
        <span className="flex w-28 items-center gap-2">
          <InlineNumber id="mrsi-gap" value={gap} onChange={setGap} unit={unitS} block />
        </span>
      </label>

      {plan.length < 2 ? (
        <p className="mt-3 rounded-md bg-app-raised px-3 py-2 text-[13px] text-app-muted">
          {t('mrsiPanel.not-enough')}
        </p>
      ) : (
        <>
          <MrsiPlanView plan={plan} startedAt={startedAt} now={now} showMode={showMode} />

          <p className="mt-2 text-[12px] text-app-muted">{t('mrsiPanel.shared')}</p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onStart}
              className="btn btn-primary flex-1"
            >
              <FieldIcon name="fire" />
              {startedAt === null ? t('mrsiPanel.start-mrsi') : t('mrsiPanel.restart')}
            </button>
            {startedAt !== null && (
              <button type="button" onClick={onStop} className="btn">
                <FieldIcon name="stop" />
                {t('fireTimer.stop')}
              </button>
            )}
          </div>
        </>
      )}
    </details>
  )
}

/** The option is on, but the weapon has no simultaneous impact: why. */
export function MrsiUnavailable() {
  return (
    <p className="panel flex items-start gap-2 px-4 py-3 text-[13px] text-app-muted">
      <FieldIcon name="stack" className="mt-0.5 h-4 w-4 shrink-0" />
      {t('mrsiPanel.unavailable')}
    </p>
  )
}
