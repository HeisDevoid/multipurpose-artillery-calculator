import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'

/**
 * The favourite star on a closed list (weapon, map): it shows at once whether
 * the selected item is a favourite and adds or removes it without opening
 * the list.
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
