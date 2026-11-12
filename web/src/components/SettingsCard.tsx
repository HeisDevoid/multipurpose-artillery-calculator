import { useEffect, useState, type ReactNode } from 'react'

import { readStoredText, writeStored } from '../lib/input'
import { SETTINGS_CARD_OPEN, settingsCardKey } from '../lib/settingsCards'
import { FieldIcon, type FieldIconName } from './FieldIcon'

/**
 * A settings section: an icon, a title and an arrow; a press collapses or
 * expands it. A collapsed section takes one line, and the page can be scrolled
 * on a phone without touching any switch.
 */
export function SettingsCard({
  id,
  icon,
  title,
  description,
  defaultOpen = false,
  children,
}: {
  id: string
  icon: FieldIconName
  title: string
  description?: string
  // Open until the user collapses it
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => {
    const stored = readStoredText(settingsCardKey(id))
    return stored === '' ? defaultOpen : stored === 'on'
  })

  function change(next: boolean) {
    setOpen(next)
    writeStored(settingsCardKey(id), next ? 'on' : 'off')
  }

  // A jump from the chip on top opens the section
  useEffect(() => {
    function onOpen(event: Event) {
      if ((event as CustomEvent<string>).detail !== id) return
      setOpen(true)
      writeStored(settingsCardKey(id), 'on')
    }
    window.addEventListener(SETTINGS_CARD_OPEN, onOpen)
    return () => window.removeEventListener(SETTINGS_CARD_OPEN, onOpen)
  }, [id])

  return (
    <section id={id} className="panel scroll-mt-20 p-4 sm:p-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => change(!open)}
        className="flex w-full cursor-pointer items-center gap-3 text-left"
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <FieldIcon name={icon} className="h-5 w-5" />
        </span>
        <h3 className="min-w-0 flex-1 text-[17px] font-semibold text-app-text">{title}</h3>
        <FieldIcon
          name="chevron"
          className={`h-5 w-5 text-app-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <>
          {description && <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">{description}</p>}
          {children}
        </>
      )}
    </section>
  )
}
