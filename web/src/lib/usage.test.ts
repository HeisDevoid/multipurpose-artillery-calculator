import { describe, expect, it, vi } from 'vitest'
import { counterUrl, reportUsage, usageDay, type UsageEnv } from './usage'

function env(patch: Partial<UsageEnv> = {}): UsageEnv & { sent: string[]; remembered: string[] } {
  const sent: string[] = []
  const remembered: string[] = []
  return {
    source: 'web',
    enabled: true,
    online: true,
    today: '2026-11-12',
    counted: null,
    remember: (day) => remembered.push(day),
    send: async (url) => {
      sent.push(url)
    },
    sent,
    remembered,
    ...patch,
  }
}

describe('usage counter', () => {
  it('counts a device once and remembers the day', async () => {
    const e = env()
    expect(await reportUsage(e)).toBe(true)
    expect(e.sent).toEqual([counterUrl('web')])
    expect(e.remembered).toEqual(['2026-11-12'])
  })

  it('has a counter of its own for the Windows app', async () => {
    const e = env({ source: 'desktop' })
    await reportUsage(e)
    expect(e.sent).toEqual([counterUrl('desktop')])
    expect(counterUrl('desktop')).not.toBe(counterUrl('web'))
  })

  it('does not count the same day twice', async () => {
    const e = env({ counted: '2026-11-12' })
    expect(await reportUsage(e)).toBe(false)
    expect(e.sent).toEqual([])
  })

  it('counts again on the next day', async () => {
    const e = env({ counted: '2026-11-11' })
    expect(await reportUsage(e)).toBe(true)
    expect(e.remembered).toEqual(['2026-11-12'])
  })

  it('sends nothing when the setting is off, offline or in a copy that is not counted', async () => {
    for (const patch of [{ enabled: false }, { online: false }, { source: null }] as Partial<UsageEnv>[]) {
      const e = env(patch)
      expect(await reportUsage(e)).toBe(false)
      expect(e.sent).toEqual([])
      expect(e.remembered).toEqual([])
    }
  })

  it('tries again later when the request failed', async () => {
    const send = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const e = env({ send })
    expect(await reportUsage(e)).toBe(false)
    expect(send).toHaveBeenCalledOnce()
    expect(e.remembered).toEqual([])
  })

  it('uses the UTC calendar day', () => {
    expect(usageDay(new Date('2026-11-12T23:59:59Z'))).toBe('2026-11-12')
    expect(usageDay(new Date('2026-11-13T00:00:01+03:00'))).toBe('2026-11-12')
  })

  it('carries no data in the address', () => {
    expect(new URL(counterUrl('web')).search).toBe('')
  })
})
