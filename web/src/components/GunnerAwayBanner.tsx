import { t } from '../i18n'
import { useSync } from '../lib/syncContext'
import { FieldIcon } from './FieldIcon'

/**
 * Стрелок в связке ушёл со страницы «Связка»: установки от наводчика
 * обновляются только на ней (и оверлей берёт их оттуда). Плашка сверху
 * с кнопкой вернуться.
 */
export function GunnerAwayBanner({ onBack }: { onBack: () => void }) {
  const sync = useSync()
  if (!sync.enabled || sync.role !== 'gunner') return null

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-warn/12 px-3.5 py-2.5 text-[13.5px] text-app-text ring-1 ring-warn/40"
    >
      <FieldIcon name="warning" className="h-[18px] w-[18px] shrink-0 text-warn" />
      <p className="min-w-0 flex-1">{t('app.gunner-away')}</p>
      <button type="button" onClick={onBack} className="btn btn-sm">
        <FieldIcon name="link" className="h-4 w-4" />
        {t('app.back-to-link')}
      </button>
    </div>
  )
}
