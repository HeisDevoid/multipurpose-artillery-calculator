import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { getLanguage, setLanguage, t, translate } from './index'
import { LANGUAGES } from './languages'
import { en, ru } from './messages'
import { de } from './messages.de'
import { fr } from './messages.fr'
import { ja } from './messages.ja'
import { uk } from './messages.uk'
import { zh } from './messages.zh'

const placeholders = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort()
const cyrillic = /[\u0400-\u04ff]/

describe('dictionaries', () => {
  const keys = Object.keys(ru)

  it('both languages have the same keys', () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort())
  })

  it('the placeholders {0}, {1} match in the Russian and English versions', () => {
    const bad = keys.filter(
      (k) => JSON.stringify(placeholders(ru[k as keyof typeof ru])) !== JSON.stringify(placeholders(en[k as keyof typeof ru]))
    )
    expect(bad).toEqual([])
  })

  it('English texts have no Cyrillic, Russian ones have it (except symbols)', () => {
    const inEn = keys.filter((k) => cyrillic.test(en[k as keyof typeof ru]))
    expect(inEn).toEqual([])
    const ALLOWED_SAME = new Set(['unit.hpa', 'picker.vanilla', 'picker.dlc', 'picker.filter-dlc'])
    const notTranslated = keys.filter(
      (k) =>
        !ALLOWED_SAME.has(k) &&
        !cyrillic.test(ru[k as keyof typeof ru]) &&
        ru[k as keyof typeof ru] === en[k as keyof typeof ru]
    )
    expect(notTranslated).toEqual([])
  })

  it('there are no empty texts', () => {
    expect(keys.filter((k) => ru[k as keyof typeof ru].trim() === '' || en[k as keyof typeof ru].trim() === '')).toEqual([])
  })
})

describe('t()', () => {
  it('takes the current language and fills in the values', () => {
    setLanguage('ru')
    expect(getLanguage()).toBe('ru')
    expect(t('markers.min', 5)).toBe(ru['markers.min'].replace('{0}', '5'))
    setLanguage('en')
    expect(t('markers.min', 5)).toBe('5 min')
    setLanguage('ru')
  })

  it('translate() works with an explicit language and gives missing arguments as empty', () => {
    expect(translate('en', 'markers.h-min', 1, 5)).toBe('1 h 5 min')
    expect(translate('en', 'markers.h-min', 1)).toBe('1 h  min')
  })
})

describe('texts are not hard-coded', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))

  function files(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== 'i18n') files(p, out)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !/\.d\.ts$/.test(name)) out.push(p)
    }
    return out
  }

  // Language names are written in the languages themselves: this is not a translation
  const ENDONYMS = new Set<string>(LANGUAGES.map((l) => l.name))

  it('Cyrillic in code strings is only in the dictionary', () => {
    const offenders: string[] = []
    for (const file of files(root)) {
      const code = readFileSync(file, 'utf8')
      const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      const visit = (n: ts.Node) => {
        if (
          (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) &&
          cyrillic.test(n.text) &&
          !ENDONYMS.has(n.text)
        ) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
          offenders.push(`${relative(root, file)}:${line} ${n.text.slice(0, 40)}`)
        }
        if (ts.isJsxText(n) && cyrillic.test(n.text)) {
          const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
          offenders.push(`${relative(root, file)}:${line} ${n.text.trim().slice(0, 40)}`)
        }
        ts.forEachChild(n, visit)
      }
      visit(sf)
    }
    expect(offenders).toEqual([])
  })
})

describe('a dictionary without junk', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))

  function sources(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        if (name !== 'i18n') sources(p, out)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(readFileSync(p, 'utf8'))
    }
    return out
  }

  it('every key is used in the code', () => {
    const code = sources(root).join('\n')
    const unused = Object.keys(ru).filter(
      (k) =>
        // hotkeys are built from the action name
        !k.startsWith('settings.hotkeys.') &&
        // help questions and answers are built by number
        !/^help\.[qa]\d+$/.test(k) &&
        !code.includes(`'${k}'`) &&
        !code.includes(`"${k}"`)
    )
    expect(unused).toEqual([])
  })
})

describe('all interface languages', () => {
  const keys = Object.keys(ru) as (keyof typeof ru)[]
  // Symbols and proper names, the same in all languages
  const SAME_AS_EN = /^(unit\.|picker\.vanilla|about\.)/
  const others = { uk, de, fr, ja, zh }

  for (const [id, dict] of Object.entries(others)) {
    describe(id, () => {
      it('the same keys and placeholders as in Russian', () => {
        expect(Object.keys(dict).sort()).toEqual([...keys].sort())
        const bad = keys.filter(
          (k) => JSON.stringify(placeholders(dict[k])) !== JSON.stringify(placeholders(ru[k]))
        )
        expect(bad).toEqual([])
      })

      it('Cyrillic only in Ukrainian (no letters that exist only in Russian)', () => {
        const withCyr = keys.filter((k) => cyrillic.test(dict[k]))
        if (id === 'uk') {
          expect(withCyr.length).toBeGreaterThan(keys.length * 0.9)
          expect(keys.filter((k) => /[\u044b\u044d\u044a\u0451\u042b\u042d\u042a\u0401]/.test(dict[k]))).toEqual([])
        } else {
          expect(withCyr).toEqual([])
        }
      })

      it('no untranslated English strings are left', () => {
        // German and French have matches (Auto, Distance): short ones are allowed
        const cognates = id === 'de' || id === 'fr'
        const same = keys.filter(
          (k) =>
            dict[k] === en[k] &&
            !SAME_AS_EN.test(k) &&
            /[A-Za-z]{4,}/.test(en[k]) &&
            !(cognates && en[k].split(' ').length <= 3)
        )
        expect(same).toEqual([])
      })
    })
  }
})
