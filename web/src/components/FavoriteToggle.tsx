import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'

/**
 * Звёздочка «в избранное» на закрытом списке (орудие, карта): сразу видно,
 * в избранном ли выбранное, и его можно добавить или убрать, не раскрывая
 * список.
 */
export function FavoriteToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const label = on ? t('picker.unfavourite') : t('picker.favourite')
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={[
        'inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-app-raised-hover',
        on ? 'text-warn' : 'text-app-faint hover:text-app-muted',
      ].join(' ')}
    >
      <FieldIcon name={on ? 'starFilled' : 'star'} className="h-4 w-4" />
    </button>
  )
}
