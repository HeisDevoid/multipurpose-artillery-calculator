import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { t } from '../i18n'
import { FieldIcon } from './FieldIcon'

export interface PickerItem {
  id: string
  title: string
  subtitle?: string
  // A group heading in the grid (mod, author…)
  group?: string
  // The card picture; icon without it
  thumb?: string
  icon?: ReactNode
  // Extra words for the search
  keywords?: string
  // DLC or mod: the filter at the top of the window works by this
  source?: 'dlc' | 'mod'
  // A badge in the card corner (for example, a quality warning)
  badge?: ReactNode
}

type SourceFilter = 'all' | 'dlc' | 'mod'

interface Props {
  title: string
  placeholder: string
  items: readonly PickerItem[]
  selectedId?: string
  onPick: (id: string) => void
  onClose: () => void
  // Favourites: a star on the card
  favorites?: readonly string[]
  onToggleFavorite?: (id: string) => void
  // At the bottom: extra actions (for example, "Suggest a map")
  footer?: ReactNode
}

/**
 * A picker window with search: the search field at the top centre, cards in a grid,
 * grouped by mod or author. For maps and weapons from mods.
 */
export function PickerDialog({
  title,
  placeholder,
  items,
  selectedId,
  onPick,
  onClose,
  favorites = [],
  onToggleFavorite,
  footer,
}: Props) {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<SourceFilter>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  // The filter is needed only when there are both DLC and mods
  const hasSources = items.some((i) => i.source === 'dlc') && items.some((i) => i.source === 'mod')

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return items.filter((item) => {
      if (source !== 'all' && item.source !== source) return false
      const haystack = `${item.title} ${item.subtitle ?? ''} ${item.group ?? ''} ${item.keywords ?? ''}`.toLowerCase()
      return words.every((w) => haystack.includes(w))
    })
  }, [items, query, source])

  // Favourites on top as a group of their own, the rest by group in order of appearance
  const groups = useMemo(() => {
    const favourite = shown.filter((i) => favorites.includes(i.id))
    const order: string[] = []
    const byGroup = new Map<string, PickerItem[]>()
    for (const item of shown) {
      if (favorites.includes(item.id)) continue
      const name = item.group ?? ''
      if (!byGroup.has(name)) {
        byGroup.set(name, [])
        order.push(name)
      }
      byGroup.get(name)!.push(item)
    }
    return [
      ...(favourite.length > 0
        ? [{ name: t('picker.favourites'), items: favourite }]
        : []),
      ...order.map((name) => ({ name, items: byGroup.get(name)! })),
    ]
  }, [shown, favorites])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="tour-fade fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 pt-5 pb-3"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="hidden shrink-0 text-lg font-semibold text-white sm:block">{title}</h2>
        <div className="relative mx-auto w-full max-w-md">
          <FieldIcon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 h-[18px] w-[18px] -translate-y-1/2 text-white/50"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && shown[0]) onPick(shown[0].id)
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="field h-11 pl-10 text-[15px]"
          />
        </div>
        <button
          type="button"
          className="btn shrink-0 px-2.5"
          aria-label={t('requests.close')}
          onClick={onClose}
        >
          <FieldIcon name="close" className="h-5 w-5" />
        </button>
      </div>

      {hasSources && (
        <div
          role="group"
          aria-label={t('picker.filter')}
          className="mx-auto flex w-full max-w-5xl justify-center gap-1.5 px-4 pb-3"
          onClick={(event) => event.stopPropagation()}
        >
          {(
            [
              ['all', t('picker.filter-all')],
              ['dlc', t('picker.filter-dlc')],
              ['mod', t('picker.filter-mods')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={source === value}
              onClick={() => setSource(value)}
              className={[
                'cursor-pointer rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition-colors',
                source === value ? 'bg-accent-solid text-white' : 'bg-white/10 text-white/80 hover:bg-white/20',
              ].join(' ')}
            >
              {label} <span className="opacity-70">{value === 'all' ? items.length : items.filter((i) => i.source === value).length}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 pb-6"
        onClick={(event) => event.stopPropagation()}
      >
        {shown.length === 0 && (
          <p className="py-16 text-center text-white/60">{t('picker.no-results')}</p>
        )}
        {groups.map((group) => (
          <section key={group.name} className="mb-5">
            {group.name && (
              <h3 className="mb-2 text-[12px] font-semibold tracking-wide text-white/50 uppercase">
                {group.name}
              </h3>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2.5">
              {group.items.map((item) => {
                const selected = item.id === selectedId
                const favorite = favorites.includes(item.id)
                return (
                  <div key={item.id} className="group relative h-full">
                    <button
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => onPick(item.id)}
                      className={[
                        'flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl bg-app-raised text-left transition-all hover:-translate-y-0.5 hover:bg-app-raised-hover',
                        selected ? 'ring-2 ring-accent' : '',
                      ].join(' ')}
                    >
                      <span className="relative flex aspect-[4/3] w-full items-center justify-center bg-app-surface">
                        {item.thumb ? (
                          <img
                            src={item.thumb}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          item.icon
                        )}
                        {/* A badge (for example, a simplified map image) in the bottom right corner of the preview */}
                        {item.badge && <span className="absolute right-1.5 bottom-1.5">{item.badge}</span>}
                      </span>
                      {/* The name at the top, the author pressed to the bottom: on one line in all cards */}
                      <span className="flex flex-1 flex-col px-2.5 py-2">
                        <span className="block text-[14px] leading-snug font-medium break-words text-app-text">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span className="mt-auto block pt-0.5 text-[11.5px] leading-snug break-words text-app-muted opacity-70">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                    </button>
                    {onToggleFavorite && (
                      <button
                        type="button"
                        aria-pressed={favorite}
                        aria-label={favorite ? t('picker.unfavourite') : t('picker.favourite')}
                        title={favorite ? t('picker.unfavourite') : t('picker.favourite')}
                        onClick={() => onToggleFavorite(item.id)}
                        className={[
                          'absolute top-1.5 right-1.5 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-black/55 backdrop-blur-sm transition-opacity hover:bg-black/75',
                          favorite ? 'text-warn opacity-100' : 'text-white/80 opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                        ].join(' ')}
                      >
                        <FieldIcon name={favorite ? 'starFilled' : 'star'} className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        {footer && <div className="mt-2 flex justify-center">{footer}</div>}
      </div>
    </div>
    ,
    document.body
  )
}
