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

// Русский и английский (он же запасной) — в основном файле сайта. Остальные
// языки грузятся по требованию: первый экран открывается быстрее.
const dictionaries: Partial<Record<Language, Dictionary>> = { ru, en }

const loaders: Record<Exclude<Language, 'ru' | 'en'>, () => Promise<Dictionary>> = {
  uk: () => import('./messages.uk').then((m) => m.uk),
  de: () => import('./messages.de').then((m) => m.de),
  fr: () => import('./messages.fr').then((m) => m.fr),
  ja: () => import('./messages.ja').then((m) => m.ja),
  zh: () => import('./messages.zh').then((m) => m.zh),
}

/** Словарь языка уже загружен: t() на нём сработает сразу. */
export function isLanguageLoaded(language: Language): boolean {
  return dictionaries[language] !== undefined
}

/** Загрузить словарь языка (до первой отрисовки и перед сменой языка). */
export async function loadLanguage(language: Language): Promise<void> {
  if (isLanguageLoaded(language)) return
  dictionaries[language] = await loaders[language as keyof typeof loaders]()
}

// Текущий язык интерфейса. Его задаёт App при каждой отрисовке, а смена
// языка перерисовывает всё приложение, поэтому t() можно звать откуда угодно.
let current: Language = 'ru'

export function setLanguage(language: Language) {
  current = language
}

export function getLanguage(): Language {
  return current
}

/** Текст на языке по ключу; {0}, {1} заменяются аргументами. Словарь ещё не загружен — по-английски. */
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

/** Текст на текущем языке. */
export function t(key: MessageKey, ...args: readonly (string | number)[]): string {
  return translate(current, key, ...args)
}
