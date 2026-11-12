import { useEffect, useState } from 'react'

/**
 * State that survives a reload (localStorage).
 * parse gets the saved string or null and decides what to take.
 */
export function usePersistentState<T>(
  key: string,
  parse: (raw: string | null) => T,
  serialize: (value: T) => string = String
) {
  const [value, setValue] = useState<T>(() => {
    try {
      return parse(localStorage.getItem(key))
    } catch {
      return parse(null)
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, serialize(value))
    } catch {
      // Storage is unavailable: the value lives until a reload.
    }
  }, [key, value, serialize])

  return [value, setValue] as const
}
