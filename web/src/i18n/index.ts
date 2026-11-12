import type { Language } from './languages'
import { en, ru } from './messages'

export type MessageKey = keyof typeof ru

export {
  LANGUAGES,
  LANGUAGE_IDS,
  detectLanguage,
  isLanguage,
  languageFromUrl,
  localeOf,
} from './languages'
export type { Language } from './languages'

type Dictionary = Record<MessageKey, string>

// Russian and English (the fallback) are in the main site file. The other
// languages load on demand: the first screen opens faster.
const dictionaries: Partial<Record<Language, Dictionary>> = { ru, en }

const loaders: Record<Exclude<Language, 'ru' | 'en'>, () => Promise<Dictionary>> = {
  uk: () => import('./messages.uk').then((m) => m.uk),
  de: () => import('./messages.de').then((m) => m.de),
  fr: () => import('./messages.fr').then((m) => m.fr),
  ja: () => import('./messages.ja').then((m) => m.ja),
  zh: () => import('./messages.zh').then((m) => m.zh),
}

/** The language dictionary is already loaded: t() works with it at once. */
export function isLanguageLoaded(language: Language): boolean {
  return dictionaries[language] !== undefined
}

/** Load a language dictionary (before the first render and before a language change). */
export async function loadLanguage(language: Language): Promise<void> {
  if (isLanguageLoaded(language)) return
  dictionaries[language] = await loaders[language as keyof typeof loaders]()
}

// The current interface language. App sets it on every render, and a language
// change re-renders the whole app, so t() can be called from anywhere.
let current: Language = 'ru'

export function setLanguage(language: Language) {
  current = language
}

export function getLanguage(): Language {
  return current
}

/** A text in a language by key; {0}, {1} are replaced with the arguments. Until the dictionary loads, English. */
export function translate(
  language: Language,
  key: MessageKey,
  ...args: readonly (string | number)[]
): string {
  const template = dictionaries[language]?.[key] ?? en[key]
  return template.replace(/\{(\d+)\}/g, (_, index: string) =>
    String(args[Number(index)] ?? '')
  )
}

/** A text in the current language. */
export function t(key: MessageKey, ...args: readonly (string | number)[]): string {
  return translate(current, key, ...args)
}
