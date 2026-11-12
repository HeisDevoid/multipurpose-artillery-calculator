/** Interface languages. The names are in the languages themselves (this way anyone recognises them). */
export const LANGUAGES = [
  { id: 'ru', name: 'Русский', locale: 'ru' },
  { id: 'en', name: 'English', locale: 'en' },
  { id: 'uk', name: 'Українська', locale: 'uk' },
  { id: 'de', name: 'Deutsch', locale: 'de' },
  { id: 'fr', name: 'Français', locale: 'fr' },
  { id: 'ja', name: '日本語', locale: 'ja' },
  { id: 'zh', name: '中文', locale: 'zh-CN' },
] as const

export type Language = (typeof LANGUAGES)[number]['id']

export const LANGUAGE_IDS: readonly Language[] = LANGUAGES.map((l) => l.id)

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGE_IDS as readonly string[]).includes(value)
}

/** The default language is the system one (the first match from the browser language list). */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0]
    if (isLanguage(primary)) return primary
  }
  return 'en'
}

/**
 * The language from the address (?lang=de): every language has a link of its own, search finds it
 * and it can be shared. No parameter or a wrong one: null.
 */
export function languageFromUrl(search: string): Language | null {
  const value = new URLSearchParams(search).get('lang')
  return isLanguage(value) ? value : null
}

/** The code for lang on <html> and for Intl. */
export function localeOf(language: Language): string {
  return LANGUAGES.find((l) => l.id === language)?.locale ?? 'en'
}
