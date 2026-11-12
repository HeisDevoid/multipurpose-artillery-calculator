import { describe, expect, it } from 'vitest'

import { shellKind } from './shellKind'

describe('shellKind', () => {
  it('high explosive by default', () => {
    expect(shellKind('HE')).toBe('he')
    expect(shellKind('')).toBe('he')
    expect(shellKind('APERS')).toBe('he')
  })

  it('illumination', () => {
    expect(shellKind('ILLUM')).toBe('illum')
    expect(shellKind('Flare')).toBe('illum')
    expect(shellKind('Illumination')).toBe('illum')
  })

  it('smoke', () => {
    expect(shellKind('SMOKE')).toBe('smoke')
    expect(shellKind('WP')).toBe('smoke')
    expect(shellKind('Smoke screen')).toBe('smoke')
  })
})
