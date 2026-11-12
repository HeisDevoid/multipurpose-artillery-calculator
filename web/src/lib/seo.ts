import {
  detectLanguage,
  isLanguage,
  languageFromUrl,
  localeOf,
  t,
  type Language,
} from '../i18n'
import { PUBLIC_SITE_URL } from './sync'

/** A link to the site version in a language: English is the main address. */
export function languageUrl(language: Language): string {
  return language === 'en' ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}?lang=${language}`
}

/**
 * The language at start: from the address (?lang=de), else the one chosen earlier,
 * else the system one.
 */
export function initialLanguage(): Language {
  if (typeof window === 'undefined') return 'en'
  const fromUrl = languageFromUrl(window.location.search)
  if (fromUrl) return fromUrl
  try {
    const stored = localStorage.getItem('language')
    if (isLanguage(stored)) return stored
  } catch {
    // Storage is unavailable: the system language.
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
 * The tab title, the description and canonical are in the interface language: search
 * shows every language version with its own text.
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
  // canonical only on the published site (not in the Windows app)
  if (window.location.href.startsWith(PUBLIC_SITE_URL)) {
    setHeadTag(
      'link[rel="canonical"]',
      () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
      'href',
      languageUrl(language)
    )
  }
}
