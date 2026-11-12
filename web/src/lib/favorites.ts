import { useCallback, useState } from 'react'

function read(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
    return Array.isArray(value)
      ? value.filter((k): k is string => typeof k === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * Favourites (maps, weapons): a list of ids in localStorage.
 * toggle adds or removes an id.
 */
export function useFavorites(storageKey: string) {
  const [favorites, setFavorites] = useState<string[]>(() => read(storageKey))

  const toggle = useCallback(
    (id: string) => {
      setFavorites((current) => {
        const next = current.includes(id)
          ? current.filter((k) => k !== id)
          : [...current, id]
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          // The list lives until a reload.
        }
        return next
      })
    },
    [storageKey]
  )

  return [favorites, toggle] as const
}
