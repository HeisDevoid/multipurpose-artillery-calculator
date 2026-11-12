import { useEffect, useRef } from 'react'

/**
 * Key → action. The key is KeyboardEvent.code ("KeyF", "Digit1"),
 * not the character: this way the keys work in any keyboard layout.
 */
export type HotkeyMap = Record<string, () => void>

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * Global hotkeys. They do not fire while the cursor is in an input
 * field (except Escape, which takes the focus off the field) and with
 * Ctrl / Alt / Meta held, so as not to get in the way of system shortcuts.
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  // The latest version of the handlers without resubscribing on every render
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  })

  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return
      if (event.repeat) return

      if (isTyping(event.target)) {
        if (event.code === 'Escape') (event.target as HTMLElement).blur()
        return
      }

      // «?» — Shift + «/»
      const code =
        event.code === 'Slash' && event.shiftKey ? 'Question' : event.code
      const action = mapRef.current[code]
      if (action) {
        event.preventDefault()
        action()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
