import { useSyncExternalStore } from 'react'

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains('dark')

/** Whether the dark theme is on; changes together with the class on <html>. */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => true)
}

/** The value of a theme CSS variable (for example, --color-accent) for a canvas. */
export function themeColor(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}
