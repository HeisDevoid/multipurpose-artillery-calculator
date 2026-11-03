import { t, type MessageKey } from '../../i18n'
import { COVERAGE_RGB, type CoverageStatus } from '../../lib/coverage'
import { FieldIcon, type FieldIconName } from '../FieldIcon'

export type CoverageMode = 'off' | 'from' | 'to'

const LEGEND: Record<CoverageStatus, MessageKey> = {
  ok: 'mapPicker.coverage-ok',
  tight: 'mapPicker.coverage-tight',
  blocked: 'mapPicker.coverage-blocked',
}

const MODES: { id: Exclude<CoverageMode, 'off'>; icon: FieldIconName; label: MessageKey }[] = [
  { id: 'from', icon: 'reachFrom', label: 'mapPicker.coverage-from' },
  { id: 'to', icon: 'standTo', label: 'mapPicker.coverage-to' },
]

/**
 * Зоны по рельефу — нижняя строка плашки координат: «Куда достаю» (вокруг
 * орудия) и «Где встать» (вокруг цели), под ними легенда цветов или
 * подсказка, если на карте нет орудия или цели.
 */
export function CoveragePanel({
  mode,
  onMode,
  ready,
}: {
  mode: CoverageMode
  onMode: (mode: CoverageMode) => void
  // Зона построена: орудие (или цель для «Где встать») стоит на карте
  ready: boolean
}) {
  return (
    <div className="pointer-events-auto border-t border-white/10 px-1.5 py-1.5">
      <div role="group" aria-label={t('mapPicker.coverage')} className="flex justify-center gap-1">
        {MODES.map(({ id, icon, label }) => {
          const active = mode === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onMode(active ? 'off' : id)}
              className={[
                'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[12px] font-medium whitespace-nowrap transition-colors',
                active ? 'bg-accent-solid text-white' : 'text-white/75 hover:bg-white/12 hover:text-white',
              ].join(' ')}
            >
              <FieldIcon name={icon} className="h-[15px] w-[15px]" />
              {t(label)}
            </button>
          )
        })}
      </div>
      {mode !== 'off' && (
        <div
          role="status"
          className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 px-1 pb-0.5 text-[11px] leading-tight text-white/80"
        >
          {ready ? (
            (['ok', 'tight', 'blocked'] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="block h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: `rgb(${COVERAGE_RGB[status]})` }}
                />
                {t(LEGEND[status])}
              </span>
            ))
          ) : (
            <span>
              {mode === 'from' ? t('mapPicker.coverage-need-gun') : t('mapPicker.coverage-need-target')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
