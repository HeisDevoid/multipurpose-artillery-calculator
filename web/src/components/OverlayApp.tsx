import { isLanguageLoaded, loadLanguage, setLanguage as setI18nLanguage, t } from '../i18n'
import { lazy, Suspense, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import {
  focusCurrentWindow,
  hideCurrentWindow,
  onHotkey,
  onOverlayShot,
  onSolution,
  requestSolution,
  resizeCurrentWindow,
  sendOverlayCommand,
  type OverlayField,
  type OverlayState,
} from '../lib/desktop'
import { formatSigned, isInvalid, parseNumber } from '../lib/input'
import type { TerrainStatus } from '../lib/mrsi'
import { useMrsiClock } from '../lib/useMrsiClock'
import { FieldIcon } from './FieldIcon'
import { ProgressBar } from './FormControls'
import { MrsiPlanView } from './MrsiPanel'

// The map in the overlay loads on demand, as in the main window
const MapPicker = lazy(() => import('./MapPicker').then((m) => ({ default: m.MapPicker })))

// The "splash" warning this many seconds before impact (as in FireTimer)
const SPLASH_WARNING_S = 5
const IMPACT_HOLD_MS = 4000

// Window size: settings / with the input panel / with the map
const WIDTH = 380
const COMPACT_HEIGHT = 230
const TERRAIN_EXTRA = 44
const EDITING_HEIGHT = 580
const MAP_WIDTH = 560
const MAP_HEIGHT = 900
// Simultaneous impact: a shot row in the plan
const MRSI_BASE_HEIGHT = 300
const MRSI_ROW = 30

const FIELDS: readonly OverlayField[] = [
  'distance',
  'azimuth',
  'ownHeight',
  'targetHeight',
]

const EMPTY_FIELDS: Record<OverlayField, string> = {
  distance: '',
  azimuth: '',
  ownHeight: '',
  targetHeight: '',
}

interface Shot {
  firedAt: number
  tof: number
}

const noop = () => {}

/**
 * A window over the game: charge, azimuth and elevation in the same order as in the
 * Arma artillery HUD (CH, AZ, EL), time of flight and the countdown to impact.
 * "Input" changes the inputs of the main window without switching to it (with the map
 * if it is on): the main window calculates and sends the new solution.
 * Terrain on the shell path and simultaneous impact are visible over Link too.
 * Fire is on a global key, the main window plays the sound.
 */
export function OverlayApp() {
  const [state, setState] = useState<OverlayState | null>(null)
  const [shot, setShot] = useState<Shot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [editing, setEditing] = useState(false)
  // A counter of "cursor to the distance field" requests (Ctrl+Alt+D)
  const [focusRequest, setFocusRequest] = useState(0)

  // The fields' own values: while a field has focus, the main window's answer
  // does not overwrite what is being typed.
  const [draft, setDraft] = useState(EMPTY_FIELDS)
  const inputsRef = useRef<Partial<Record<OverlayField, HTMLInputElement>>>(
    {}
  )

  // The latest state for the fire key handler
  const stateRef = useRef<OverlayState | null>(null)

  // The input panel is only for own inputs, not for data over Link
  const canEdit = editing && state !== null && !state.readOnly
  // With the map: Input opens the map over the game
  const mapMode = canEdit && Boolean(state?.map)
  const solution = state?.solution ?? null
  const mrsi = solution ? (state?.mrsi ?? null) : null
  const terrain: TerrainStatus = solution ? (state?.terrain ?? null) : null

  useEffect(() => {
    const stop = onSolution((next) => {
      stateRef.current = next
      setState(next)
      setDraft((previous) => {
        const focused = FIELDS.find(
          (field) => inputsRef.current[field] === document.activeElement
        )
        return focused
          ? { ...next.fields, [focused]: previous[focused] }
          : next.fields
      })
    })
    requestSolution()
    return stop
  }, [])

  // The window size fits what it shows
  const mrsiShots = mrsi?.shots.length ?? 0
  const width = mapMode ? MAP_WIDTH : WIDTH
  const height = mapMode
    ? MAP_HEIGHT
    : canEdit
      ? EDITING_HEIGHT
      : (mrsiShots > 0 ? MRSI_BASE_HEIGHT + MRSI_ROW * mrsiShots : COMPACT_HEIGHT) +
        (terrain ? TERRAIN_EXTRA : 0)
  useEffect(() => {
    void resizeCurrentWindow(width, height)
  }, [width, height])

  useEffect(
    () =>
      onHotkey((action) => {
        if (action === 'input') {
          setEditing(true)
          setFocusRequest((value) => value + 1)
          return
        }
        const current = stateRef.current
        // The main window starts the simultaneous impact: the start time comes with the state
        if (action !== 'fire' || !current?.solution || current.mrsi) return
        const firedAt = Date.now()
        setNow(firedAt)
        setShot({ firedAt, tof: current.solution.tof })
      }),
    []
  )

  // The field appears only after the input panel is drawn
  useEffect(() => {
    if (focusRequest === 0) return
    void focusCurrentWindow().then(() => {
      const field = inputsRef.current.distance
      field?.focus()
      field?.select()
    })
  }, [focusRequest])

  // The map in the overlay: the window needs focus for clicks and the wheel
  useEffect(() => {
    if (mapMode) void focusCurrentWindow()
  }, [mapMode])

  // A shot from the main window or over Link
  useEffect(
    () =>
      onOverlayShot(() => {
        const current = stateRef.current
        if (!current?.solution || current.mrsi) return
        const firedAt = Date.now()
        setNow(firedAt)
        setShot({ firedAt, tof: current.solution.tof })
      }),
    []
  )

  useEffect(() => {
    if (!shot) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      if (current - shot.firedAt > shot.tof * 1000 + IMPACT_HOLD_MS) {
        setShot(null)
        return
      }
      setNow(current)
    }, 100)
    return () => window.clearInterval(interval)
  }, [shot])

  // Time on target: the countdown to the shot
  const fireAt = state?.fireAt ?? null
  useEffect(() => {
    if (fireAt === null) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current - fireAt > 4000) window.clearInterval(interval)
    }, 100)
    return () => window.clearInterval(interval)
  }, [fireAt])
  const totLeft = fireAt === null ? null : (fireAt - now) / 1000

  // Simultaneous impact: its own clock (the main window plays the sound)
  const mrsiNow = useMrsiClock(mrsi?.shots ?? [], mrsi?.startedAt ?? null, noop, false)

  // The overlay is a separate window: the language comes with the state,
  // the dictionary loads later (English until it arrives)
  const language = state?.language ?? 'ru'
  setI18nLanguage(language)
  const [, setDictionaryTick] = useState(0)
  useEffect(() => {
    if (!isLanguageLoaded(language)) void loadLanguage(language).then(() => setDictionaryTick((n) => n + 1))
  }, [language])
  const left = shot ? shot.tof - (now - shot.firedAt) / 1000 : null

  function changeField(field: OverlayField, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }))
    sendOverlayCommand({ type: 'field', field, value })
  }

  // Enter goes to the next field, Escape removes the cursor
  function handleFieldKey(
    event: KeyboardEvent<HTMLInputElement>,
    field: OverlayField
  ) {
    if (event.key === 'Escape') {
      event.currentTarget.blur()
      return
    }
    if (event.key !== 'Enter') return
    const next = FIELDS[FIELDS.indexOf(field) + 1]
    const target = next ? inputsRef.current[next] : null
    if (target) {
      target.focus()
      target.select()
    } else {
      event.currentTarget.blur()
    }
  }

  const labels: Record<OverlayField, string> = {
    distance: t('overlayApp.distance-m'),
    azimuth: `${t('artilleryCalculator.azimuth')}, ${state?.azimuthUnit ?? ''}`,
    ownHeight: t('artilleryCalculator.gun-height'),
    targetHeight: t('artilleryCalculator.target-height'),
  }

  return (
    <div
      data-tauri-drag-region
      className="flex h-screen select-none flex-col overflow-y-auto rounded-xl bg-black/80 p-3 text-app-text-2"
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <span data-tauri-drag-region className="h-2 w-2 shrink-0 rounded-full bg-gun" />
        <p
          data-tauri-drag-region
          className="min-w-0 flex-1 break-words text-[15px] font-semibold text-app-text"
        >
          {state ? (state.targetName ?? state.title) : t('overlayApp.no-data')}
        </p>
        {state?.readOnly ? (
          <span className="tag tag-info">{t('overlayApp.from-fdc')}</span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-pressed={editing}
            title={t('overlayApp.input-ctrl-alt-d')}
            className={[
              'btn btn-sm min-h-7 px-2.5',
              editing ? 'bg-app-raised-hover text-app-text' : '',
            ].join(' ')}
          >
            {state?.map && <FieldIcon name="map" className="h-4 w-4" />}
            {t('overlayApp.input')}
          </button>
        )}
        <button
          type="button"
          onClick={() => void hideCurrentWindow()}
          aria-label={t('overlayApp.hide-overlay')}
          className="cursor-pointer rounded-md px-2 text-lg leading-none text-app-muted hover:bg-app-raised hover:text-app-text"
        >
          ×
        </button>
      </div>

      {solution && mrsi ? (
        // Simultaneous impact: the azimuth is shared, the charge and elevation are per shot
        <div data-tauri-drag-region className="mt-2">
          <div data-tauri-drag-region className="flex items-end justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-app-text">
              <FieldIcon name="stack" className="h-4 w-4 text-app-muted" />
              {t('mrsiPanel.simultaneous-impact-mrsi')}
            </p>
            <Readout label={t('artilleryCalculator.azimuth')} game="AZ" unit={solution.azimuthUnit} size="md">
              {solution.azimuth ?? '-'}
            </Readout>
          </div>
          <div className="mt-2">
            <MrsiPlanView
              plan={mrsi.shots}
              startedAt={mrsi.startedAt}
              now={mrsiNow}
              showMode={state?.modes ? state.modes.length > 1 : false}
              compact
            />
          </div>
        </div>
      ) : solution ? (
        // The order as in the Arma artillery HUD: CH, AZ, EL
        <div
          data-tauri-drag-region
          className={[
            'mt-2 grid grid-cols-[auto_1fr_1fr] content-center gap-x-4 gap-y-2',
            canEdit ? '' : 'flex-1',
          ].join(' ')}
        >
          <Readout label={t('artilleryCalculator.charge')} game="CH" size="lg">
            {solution.charge}
            {solution.mode === 'LOW' && <span className="tag tag-warn ml-1.5 align-middle">LOW</span>}
          </Readout>
          <Readout
            label={t('artilleryCalculator.azimuth')}
            game="AZ"
            unit={solution.azimuth !== null ? solution.azimuthUnit : undefined}
            size="lg"
            faint={solution.azimuth === null}
          >
            {solution.azimuth ?? '-'}
          </Readout>
          <Readout label={t('artilleryCalculator.elevation')} game="EL" unit={t('unit.mil')} size="lg">
            {Math.round(solution.elevation)}
          </Readout>
          <p className="col-span-3 flex items-center gap-2 text-[14px] text-app-text tabular-nums">
            <span className="label">{t('combatScreen.flight')}</span>
            {solution.tof.toFixed(1)} {t('unit.s')}
          </p>
        </div>
      ) : (
        <p
          data-tauri-drag-region
          className={[
            'label flex items-center py-2',
            canEdit ? '' : 'flex-1',
          ].join(' ')}
        >
          {state?.readOnly
            ? t('overlayApp.waiting-for-the-fire-direction')
            : t('overlayApp.enter-a-distance-here-input')}
        </p>
      )}

      {/* Terrain on the shell path: visible over Link too, so the gunner can report it */}
      {terrain && (
        <p
          className={[
            'mt-2 flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[13px] leading-snug font-medium',
            terrain === 'blocked' ? 'bg-danger/20 text-danger' : 'bg-warn/15 text-warn',
          ].join(' ')}
        >
          <FieldIcon name="mountain" className="mt-px h-4 w-4 shrink-0" />
          {terrain === 'blocked' ? t('terrain.short-blocked') : t('terrain.short-tight')}
        </p>
      )}

      {!mrsi && totLeft !== null && totLeft > -3 && !shot && (
        <p
          className={[
            'mt-2 flex items-baseline justify-between rounded-lg px-3 py-1.5',
            totLeft <= 5 ? 'bg-accent-solid text-white' : 'bg-app-raised',
          ].join(' ')}
        >
          <span className="text-[13px] font-medium">
            {totLeft <= 0
              ? t('overlayApp.fire')
              : t('overlayApp.fire-on-time')}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            T−{Math.max(0, totLeft).toFixed(1)}
          </span>
        </p>
      )}

      {!mrsi && left !== null && shot && (
        <div className="mt-2">
          <p
            className={[
              'flex items-baseline justify-between',
              left <= SPLASH_WARNING_S ? 'text-danger' : 'text-app-text',
            ].join(' ')}
          >
            <span className="text-[13px] font-medium">
              {left <= 0
                ? t('fireTimer.impact')
                : left <= SPLASH_WARNING_S
                  ? t('fireTimer.splash')
                  : t('overlayApp.impact-in')}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              T−{Math.max(0, left).toFixed(1)}
            </span>
          </p>
          <ProgressBar
            progress={1 - left / shot.tof}
            alert={left <= SPLASH_WARNING_S}
            className="mt-1.5"
          />
        </div>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-1 flex-col gap-2.5 border-t border-app-line-strong pt-3">
          {/* The map over the game: the gun and the target are placed here, the main window calculates */}
          {mapMode && state.map && (
            <Suspense fallback={<p className="label py-10 text-center">{t('artilleryCalculator.loading-the-map')}</p>}>
              <MapPicker
                language={state.language}
                currentTarget={state.map.target}
                reach={state.map.reach}
                category={state.map.category}
                shellType={state.map.shellType}
                onApply={(selection) => sendOverlayCommand({ type: 'map', selection })}
              />
            </Suspense>
          )}

          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((field) => (
              <label key={field} className="block">
                <span className="label">{labels[field]}</span>
                <input
                  ref={(element) => {
                    if (element) inputsRef.current[field] = element
                  }}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft[field]}
                  onChange={(event) => changeField(field, event.target.value)}
                  onKeyDown={(event) => handleFieldKey(event, field)}
                  aria-invalid={isInvalid(draft[field])}
                  className="field mt-1 px-2 py-1 text-base"
                />
              </label>
            ))}
          </div>

          <ChargeRow state={state} />

          <SpotReport state={state} />
        </div>
      )}
    </div>
  )
}

/** One setting value: a label as in the game HUD (CH / AZ / EL) and a large number. */
function Readout({
  label,
  game,
  unit,
  size,
  faint = false,
  children,
}: {
  label: string
  game: string
  unit?: string
  size: 'lg' | 'md'
  faint?: boolean
  children: ReactNode
}) {
  return (
    <div data-tauri-drag-region className="min-w-0">
      <p className="label flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="font-semibold text-app-text-2">{game}</span>
        {label}
      </p>
      <p
        className={[
          'readout mt-0.5 font-semibold whitespace-nowrap',
          size === 'lg' ? 'text-[40px] leading-[1.1]' : 'text-[28px] leading-tight',
          faint ? 'text-app-faint' : '',
        ].join(' ')}
      >
        {children}
        {unit && <span className="ml-1 text-[13px] font-normal text-app-muted">{unit}</span>}
      </p>
    </div>
  )
}

/** The charges that can reach the target, and the HIGH/LOW mode. */
function ChargeRow({ state }: { state: OverlayState }) {
  if (state.charges.length === 0 && state.modes.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="label mr-1">{t('artilleryCalculator.charge')}</span>
      {state.charges.map((charge) => (
        <button
          key={charge}
          type="button"
          onClick={() => sendOverlayCommand({ type: 'charge', charge })}
          className={[
            'min-w-8 cursor-pointer rounded-md px-2 py-0.5 text-[14px] tabular-nums',
            state.solution?.charge === charge
              ? 'bg-accent-solid text-white'
              : 'bg-app-raised hover:bg-app-raised-hover',
          ].join(' ')}
        >
          {charge}
        </button>
      ))}
      {state.modes.length > 1 && (
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'mode' })}
          className="btn btn-sm ml-auto min-h-7 px-2.5"
        >
          {state.mode === 'LOW' ? <span className="text-warn">LOW</span> : 'HIGH'}
        </button>
      )}
    </div>
  )
}

/** A burst report along the gun to target line. */
function SpotReport({ state }: { state: OverlayState }) {
  const [range, setRange] = useState('')
  const [rangeSide, setRangeSide] = useState<'over' | 'short'>('over')
  const [lateral, setLateral] = useState('')
  const [lateralSide, setLateralSide] = useState<'left' | 'right'>('left')

  const rangeValue = Math.abs(parseNumber(range) ?? 0)
  const lateralValue = Math.abs(parseNumber(lateral) ?? 0)
  const canAdd =
    (rangeValue > 0 || lateralValue > 0) &&
    !isInvalid(range) &&
    !isInvalid(lateral)

  function add() {
    if (!canAdd) return
    sendOverlayCommand({
      type: 'spot',
      over: rangeSide === 'over' ? rangeValue : -rangeValue,
      right: lateralSide === 'right' ? lateralValue : -lateralValue,
    })
    setRange('')
    setLateral('')
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') add()
    if (event.key === 'Escape') event.currentTarget.blur()
  }

  const { adjust } = state
  const unitM = t('unit.m')

  return (
    <div>
      <p className="label">
        {t('overlayApp.impact-gun-target-line')}
      </p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <SpotInput
          value={range}
          onChange={setRange}
          onKeyDown={handleKey}
          sides={[
            ['over', t('overlayApp.over')],
            ['short', t('overlayApp.short')],
          ]}
          side={rangeSide}
          onSide={setRangeSide}
        />
        <SpotInput
          value={lateral}
          onChange={setLateral}
          onKeyDown={handleKey}
          sides={[
            ['left', t('overlayApp.left')],
            ['right', t('overlayApp.right')],
          ]}
          side={lateralSide}
          onSide={setLateralSide}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="btn btn-primary btn-sm min-h-7 px-2.5"
        >
          {t('overlayApp.apply')}
        </button>
        <button
          type="button"
          onClick={() => sendOverlayCommand({ type: 'undo-adjust' })}
          disabled={adjust.count === 0}
          className="btn btn-sm min-h-7 px-2.5"
        >
          {t('overlayApp.undo')}
        </button>
        <p className="min-w-0 flex-1 break-words text-right text-[12.5px] text-app-muted tabular-nums">
          {adjust.count === 0
            ? t('overlayApp.no-corrections')
            : `${t('overlayApp.range')} ${formatSigned(adjust.range, 0)} · ${
                t('overlayApp.lat')
              } ${formatSigned(adjust.lateral, 0)} ${unitM}`}
        </p>
      </div>
    </div>
  )
}

function SpotInput<T extends string>({
  value,
  onChange,
  onKeyDown,
  sides,
  side,
  onSide,
}: {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  sides: readonly [[T, string], [T, string]]
  side: T
  onSide: (side: T) => void
}) {
  return (
    <div>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        aria-invalid={isInvalid(value)}
        className="field px-2 py-1 text-base"
      />
      <div className="mt-1 flex gap-1">
        {sides.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSide(id)}
            className={[
              'flex-1 cursor-pointer rounded-md px-1 py-0.5 text-[12.5px] font-medium',
              side === id
                ? 'bg-app-raised-hover text-app-text'
                : 'bg-app-raised text-app-muted hover:text-app-text',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
