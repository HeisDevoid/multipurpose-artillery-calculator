import { describe, expect, it } from 'vitest'

import { artilleryRegistry } from '../data/artillery/registry'
import type { BallisticProfile, BallisticRow } from '../types/artillery'
import { hasDragData, selectProfile } from './profileSelect'

// A row without weather corrections (5 columns) and with them (12 columns)
const plain = [1000, 1300, 4.8, 0.7, 30.7] as unknown as BallisticRow
const weather = [1000, 1290, 4.9, 0.7, 30.9, 0.1, 2, -2, 1, -1, 1, -1] as unknown as BallisticRow

const make = (modes: BallisticProfile['modes']) => ({ columns: [], units: {}, modes }) as BallisticProfile

describe('selectProfile', () => {
  const noDrag = make({ HIGH: { 0: [plain] }, LOW: { 0: [plain] } })
  const drag = make({ LOW: { 0: [weather] } })
  const ammo = { profile: 'default', advancedProfile: 'advanced' }

  it('weather corrections in a table mean it was taken with air resistance', () => {
    expect(hasDragData(noDrag)).toBe(false)
    expect(hasDragData(drag)).toBe(true)
  })

  it('without advanced ballistics: tables without air resistance', () => {
    const r = selectProfile({ profiles: { default: noDrag, advanced: drag } }, ammo, false)
    expect(r).toEqual({ profile: noDrag, substituted: [] })
  })

  it('with advanced ballistics: tables with air resistance, a missing trajectory from the others', () => {
    const r = selectProfile({ profiles: { default: noDrag, advanced: drag } }, ammo, true)
    expect(r.substituted).toEqual(['HIGH'])
    expect(r.profile?.modes.LOW).toBe(drag.modes.LOW)
    expect(r.profile?.modes.HIGH).toBe(noDrag.modes.HIGH)
    // The same object on a repeated call
    expect(selectProfile({ profiles: { default: noDrag, advanced: drag } }, ammo, true).profile).toBe(r.profile)
  })

  it('plain tables with weather corrections are tables with air resistance', () => {
    const only = { profiles: { default: drag } }
    expect(selectProfile(only, { profile: 'default' }, true)).toEqual({ profile: drag, substituted: [] })
    // There are no tables of its own without air resistance: these are used with a warning
    expect(selectProfile(only, { profile: 'default' }, false)).toEqual({ profile: drag, substituted: ['LOW'] })
  })

  it('no tables with air resistance: the plain ones and a warning', () => {
    const r = selectProfile({ profiles: { default: noDrag } }, { profile: 'default' }, true)
    expect(r).toEqual({ profile: noDrag, substituted: ['HIGH', 'LOW'] })
  })

  it('no profile at all: no warning', () => {
    expect(selectProfile({ profiles: {} }, undefined, true)).toEqual({ profile: undefined, substituted: [] })
  })

  it('M101: both trajectories without air resistance, the low one with it too', () => {
    const m101 = artilleryRegistry.m101
    const ammo101 = m101.ammunition?.[0]
    expect(selectProfile(m101, ammo101, false).substituted).toEqual([])
    expect(hasDragData(selectProfile(m101, ammo101, false).profile)).toBe(false)
    const advanced = selectProfile(m101, ammo101, true)
    expect(advanced.substituted).toEqual(['HIGH'])
    expect(hasDragData(advanced.profile)).toBe(true)
  })
})
