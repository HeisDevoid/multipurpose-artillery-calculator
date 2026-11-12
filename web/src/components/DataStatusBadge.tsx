import { t } from '../i18n'
import { DATA_STATUS_HINTS as HINTS, dataStatusLabel } from '../lib/dataStatus'
import type { MissingTables } from '../data/artillery/tables'
import type { DataStatus } from '../types/artillery'
import { FieldIcon } from './FieldIcon'

/**
 * The badge of the weapon tables. In the corner of the tile: a yellow "!" means the tables
 * are incomplete (no set without air resistance or with it), a green check mark means
 * verified by firing in the game, otherwise there is no badge. Details are in the tooltip.
 */
export function DataStatusBadge({
  status,
  missing = [],
  compact = false,
  corner = false,
}: {
  status: DataStatus
  // Which table sets are missing
  missing?: readonly MissingTables[]
  // The badge only (the label is in the tooltip)
  compact?: boolean
  // A small badge in the bottom right corner of the weapon tile
  corner?: boolean
}) {
  const incomplete = missing.length > 0
  const ok = status === 'verified' && !incomplete
  const label = dataStatusLabel(status)
  const missingText = missing
    .map((kind) => (kind === 'no-air' ? t('dataStatus.missing-no-air') : t('dataStatus.missing-air')))
    .join(', ')
  const text = incomplete
    ? `${t('dataStatus.incomplete', missingText)} ${label}.`
    : `${label}. ${t(HINTS[status])}`
  if (corner) {
    if (!incomplete && !ok) return null
    return (
      <span
        role="img"
        data-status={incomplete ? 'incomplete' : status}
        title={text}
        aria-label={text}
        className={[
          'absolute right-0.5 bottom-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-black/80',
          ok ? 'bg-ok' : 'bg-warn',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-2.5 w-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ok ? <path d="m6.5 12.5 3.6 3.6L17.5 8.5" /> : <path d="M12 5.5v8M12 18.5v.01" />}
        </svg>
      </span>
    )
  }
  return (
    <span
      role="img"
      data-status={status}
      title={text}
      aria-label={text}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-full text-[11.5px] font-medium',
        compact ? 'h-5 w-5 justify-center' : 'px-2 py-0.5',
        ok ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn',
      ].join(' ')}
    >
      <FieldIcon name={ok ? 'shieldCheck' : 'warning'} className="h-3.5 w-3.5" />
      {!compact && label}
    </span>
  )
}
