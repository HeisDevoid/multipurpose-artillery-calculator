import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'
import { useEffect, useState } from 'react'

import {
  observerToGun,
  reportToAdjustment,
  sumAdjustments,
  type Adjustment,
} from '../lib/adjust'
import { degToMil } from '../lib/ballistics'
import {
  formatSigned,
  isInvalid,
  parseNumber,
  readStored,
  readStoredText,
  writeStored,
} from '../lib/input'
import type { AngleUnit } from '../lib/journal'
import { NumberField, Toggle } from './FormControls'

export interface AdjustmentEntry extends Adjustment {
  // How the report was entered, for the history
  label: string
}

type Frame = 'gun' | 'observer'

interface Props {
  history: readonly AdjustmentEntry[]
  onAdd: (entry: AdjustmentEntry) => void
  onUndo: () => void
  onReset: () => void
  // Gun → target azimuth, mils; needed for the observer mode
  gunAzimuthMil: number | null
  azimuthUnit: AngleUnit
}

/**
 * Adjusting fire from a report: where the burst landed relative to the target.
 * A report can be given along the gun line or along the observer line;
 * in the second case it is converted to the gun to target line.
 * Reports add up; the last one can be undone.
 */
export function AdjustFire({
  history,
  onAdd,
  onUndo,
  onReset,
  gunAzimuthMil,
  azimuthUnit,
}: Props) {
  const unitM = t('unit.m')
  const unitAngle = azimuthUnit === 'mil' ? (t('unit.mil')) : '°'

  const [frame, setFrame] = useState<Frame>(() =>
    readStored<Frame>('adjustFrame', ['gun', 'observer'], 'gun')
  )
  // The observer usually stays put between bursts: remember the position.
  const [observerAzimuth, setObserverAzimuth] = useState(() =>
    readStoredText('observerAzimuth')
  )

  const [rangeMiss, setRangeMiss] = useState('')
  const [rangeSide, setRangeSide] = useState<'short' | 'over'>('over')
  const [lateralMiss, setLateralMiss] = useState('')
  const [lateralSide, setLateralSide] = useState<'left' | 'right'>('left')

  useEffect(() => writeStored('adjustFrame', frame), [frame])
  useEffect(
    () => writeStored('observerAzimuth', observerAzimuth),
    [observerAzimuth]
  )

  const total = sumAdjustments(history)

  const rangeValue = Math.abs(parseNumber(rangeMiss) ?? 0)
  const lateralValue = Math.abs(parseNumber(lateralMiss) ?? 0)

  const observerValue = parseNumber(observerAzimuth)
  const observerMil =
    observerValue === null
      ? null
      : azimuthUnit === 'mil'
        ? observerValue
        : degToMil(observerValue)

  const observerReady =
    frame === 'gun' || (observerMil !== null && gunAzimuthMil !== null)

  const canAdd =
    (rangeValue > 0 || lateralValue > 0) &&
    !isInvalid(rangeMiss) &&
    !isInvalid(lateralMiss) &&
    observerReady

  function describeReport(): string {
    const parts: string[] = []
    if (rangeValue > 0) {
      const side =
        rangeSide === 'short'
          ? t('adjustFire.short')
          : t('adjustFire.over')
      parts.push(`${side} ${rangeValue}`)
    }
    if (lateralValue > 0) {
      const side =
        lateralSide === 'left'
          ? t('adjustFire.left')
          : t('adjustFire.right')
      parts.push(`${side} ${lateralValue}`)
    }
    const text = parts.join(', ')
    return frame === 'observer'
      ? `${text} (${t('adjustFire.obs')} ${observerAzimuth.trim()} ${unitAngle})`
      : text
  }

  function add() {
    if (!canAdd) return

    const local = reportToAdjustment({
      over: rangeSide === 'over' ? rangeValue : -rangeValue,
      right: lateralSide === 'right' ? lateralValue : -lateralValue,
    })

    const adjustment =
      frame === 'observer' && observerMil !== null && gunAzimuthMil !== null
        ? observerToGun(local, observerMil, gunAzimuthMil)
        : local

    onAdd({ ...adjustment, label: describeReport() })
    setRangeMiss('')
    setLateralMiss('')
  }

  function describe(adjustment: Adjustment): string {
    const parts: string[] = []
    if (Math.round(adjustment.range) !== 0) {
      parts.push(
        `${t('adjustFire.range')} ${formatSigned(adjustment.range, 0)} ${unitM}`
      )
    }
    if (Math.round(adjustment.lateral) !== 0) {
      const side =
        adjustment.lateral > 0
          ? t('adjustFire.right-2')
          : t('adjustFire.left-2')
      parts.push(`${side} ${Math.abs(adjustment.lateral).toFixed(0)} ${unitM}`)
    }
    return parts.length > 0 ? parts.join(' · ') : t('adjustFire.none')
  }

  const hasTotal = history.length > 0

  return (
    <details
      id="adjust-fire"
      open={hasTotal}
      className="disclosure panel p-4 sm:p-5"
    >
      <summary>
        <span className="inline-flex items-center gap-2 text-app-text">
          <FieldIcon name="correction" className="h-5 w-5 text-app-muted" />
          {t('adjustFire.adjust-fire')}
        </span>
        {hasTotal && (
          <span className="tag tag-accent whitespace-normal">{describe(total)}</span>
        )}
      </summary>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="label flex items-center gap-1.5">
          <FieldIcon name="line" />
          {t('adjustFire.report-along')}
        </span>
        <Toggle
          label={t('adjustFire.report-frame')}
          value={frame}
          onChange={setFrame}
          options={[
            { value: 'gun', label: t('adjustFire.gun-target'), icon: 'gun' },
            {
              value: 'observer',
              label: t('adjustFire.observer-target'),
              icon: 'observer',
            },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4">
        {frame === 'observer' && (
          <NumberField
            id="adjust-observer"
            icon="observer"
            className="sm:col-span-2"
            label={
              t('adjustFire.observer-target-azimuth', unitAngle)
            }
            value={observerAzimuth}
            onChange={setObserverAzimuth}
            hint={
              gunAzimuthMil === null
                ? t('adjustFire.the-gun-azimuth-to-target')
                : t('adjustFire.the-observer-reports-left-right')
            }
          />
        )}

        <NumberField
          id="adjust-range"
          icon="distance"
          label={t('adjustFire.range-m')}
          value={rangeMiss}
          onChange={setRangeMiss}
          onEnter={add}
          aside={
            <Toggle
              label={t('adjustFire.short-or-over')}
              value={rangeSide}
              onChange={setRangeSide}
              options={[
                { value: 'short', label: t('adjustFire.short'), icon: 'arrowDown' },
                { value: 'over', label: t('adjustFire.over'), icon: 'arrowUp' },
              ]}
            />
          }
        />
        <NumberField
          id="adjust-lateral"
          icon="correction"
          label={t('adjustFire.deflection-m')}
          value={lateralMiss}
          onChange={setLateralMiss}
          onEnter={add}
          aside={
            <Toggle
              label={t('adjustFire.left-or-right')}
              value={lateralSide}
              onChange={setLateralSide}
              options={[
                { value: 'left', label: t('adjustFire.left'), icon: 'arrowLeft' },
                { value: 'right', label: t('adjustFire.right'), icon: 'arrowRight' },
              ]}
            />
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {hasTotal && (
          <>
            <button type="button" onClick={onUndo} className="btn">
              <FieldIcon name="undo" />
              {t('adjustFire.undo-last')}
            </button>
            <button type="button" onClick={onReset} className="btn btn-danger">
              <FieldIcon name="trash" />
              {t('adjustFire.reset')}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={!canAdd}
          onClick={add}
          className="btn btn-primary"
        >
          <FieldIcon name="correction" />
          {t('adjustFire.apply')}
          <span className="hidden opacity-70 sm:inline">↵</span>
        </button>
      </div>

      {hasTotal && (
        <div className="mt-4 border-t border-app-border pt-3">
          <p className="text-sm">
            <span className="label">
              {t('adjustFire.total-for-the-gun')}
            </span>{' '}
            <span className="mono-num ml-1 text-accent">{describe(total)}</span>
          </p>

          <ol className="mt-2 space-y-1 text-[12.5px] text-app-muted">
            {history.map((entry, index) => (
              <li key={index} className="flex flex-wrap justify-between gap-2">
                <span>
                  {index + 1}. {entry.label}
                </span>
                <span className="tabular-nums">→ {describe(entry)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </details>
  )
}
