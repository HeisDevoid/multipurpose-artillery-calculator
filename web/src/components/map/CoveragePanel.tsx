import { t, type MessageKey } from '../../i18n'
import { COVERAGE_RGB, type CoverageStatus } from '../../lib/coverage'
import { FieldIcon, type FieldIconName } from '../FieldIcon'

export type CoverageMode = 'off' | 'from' | 'to'

const LEGEND: Record<CoverageStatus, MessageKey> = {
  ok: 'mapPicker.coverage-ok',
  tight: 'mapPicker.coverage-tight',
  blocked: 'mapPicker.coverage-blocked',
}

const MODES: { id: Exclude<CoverageMode, 'off'>; icon: FieldIconName }[] = [
  { id: 'from', icon: 'reachFrom' },
  { id: 'to', icon: 'standTo' },
]

/**
 * Зоны по рельефу слева снизу на карте: «Куда достаю» и «Где встать» —
 * сегменты в стиле панели инструментов, над ними легенда цветов
 * (или подсказка, если на карте нет орудия или цели).
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
    // Над плашкой координат: на телефоне она в две строки
    <div className="absolute bottom-16 left-2 flex max-w-[calc(100%-4rem)] flex-col items-start gap-1.5 sm:bottom-[3.25rem]">
      {mode !== 'off' && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-[11.5px] leading-tight text-white/85 shadow-lg backdrop-blur-sm"
        >
          {ready ? (
            (['ok', 'tight', 'blocked'] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  className="block h-2.5 w-2.5 shrink-0 rounded-[3px]"
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
      <div
        role="group"
        aria-label={t('mapPicker.coverage')}
        className="flex gap-1 rounded-lg bg-black/70 p-1 shadow-lg backdrop-blur-sm"
      >
        {MODES.map(({ id, icon }) => {
          const active = mode === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onMode(active ? 'off' : id)}
              className={[
                'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors',
                active ? 'bg-accent-solid text-white' : 'text-white/80 hover:bg-white/15',
              ].join(' ')}
            >
              <FieldIcon name={icon} className="h-[18px] w-[18px]" />
              {id === 'from' ? t('mapPicker.coverage-from') : t('mapPicker.coverage-to')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
