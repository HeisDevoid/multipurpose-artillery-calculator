import {
  detectLanguage,
  isLanguage,
  languageFromUrl,
  localeOf,
  t,
  type Language,
} from '../i18n'
import { PUBLIC_SITE_URL } from './sync'

/** Ссылка на версию сайта на языке: английская — основной адрес. */
export function languageUrl(language: Language): string {
  return language === 'en' ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}?lang=${language}`
}

/**
 * Язык при открытии: из адреса (?lang=de), иначе выбранный раньше,
 * иначе как у системы.
 */
export function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const fromUrl = languageFromUrl(window.location.search)
  if (fromUrl) return fromUrl
  try {
    const stored = localStorage.getItem('language')
    if (isLanguage(stored)) return stored
  } catch {
    // Хранилище недоступно — язык системы.
  }
  return detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language])
}

function setHeadTag(selector: string, create: () => HTMLElement, attribute: string, value: string) {
  let tag = document.head.querySelector<HTMLElement>(selector)
  if (!tag) {
    tag = create()
    document.head.appendChild(tag)
  }
  tag.setAttribute(attribute, value)
}

/**
 * Заголовок вкладки, описание и canonical — на языке интерфейса: поиск
 * показывает каждую языковую версию своим текстом.
 */
export function applyHead(language: Language) {
  document.documentElement.lang = localeOf(language)
  document.title = t('seo.title')
  setHeadTag(
    'meta[name="description"]',
    () => Object.assign(document.createElement('meta'), { name: 'description' }),
    'content',
    t('seo.description')
  )
  // canonical только у опубликованного сайта (не у программы для ПК)
  if (window.location.href.startsWith(PUBLIC_SITE_URL)) {
    setHeadTag(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      'href',
      languageUrl(language)
    )
  }
}
