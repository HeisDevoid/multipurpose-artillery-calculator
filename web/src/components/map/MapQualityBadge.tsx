import { t } from '../../i18n'
import { FieldIcon } from '../FieldIcon'

/** Карта снята из игры без grad_meh: предупреждение, как у непроверенного орудия. */
export function MapQualityBadge({ inline = false }: { inline?: boolean }) {
  const text = `${t('mapQuality.low')}. ${t('mapQuality.low-hint')}`
  // Внутри кнопки: значок как у остальных кнопок, без подложки
  if (inline) {
    return (
      <span role="img" data-quality="low" title={text} aria-label={text} className="inline-flex shrink-0 text-warn">
        <FieldIcon name="warning" className="h-[18px] w-[18px]" />
      </span>
    )
  }
  return (
    <span
      role="img"
      data-quality="low"
      title={text}
      aria-label={text}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffb020] text-black shadow-md ring-2 ring-black/40"
    >
      <FieldIcon name="warning" className="h-4 w-4" />
    </span>
  )
}
