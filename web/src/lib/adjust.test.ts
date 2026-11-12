import { describe, expect, it } from 'vitest'

import {
  observerToGun,
  reportToAdjustment,
  sumAdjustments,
} from './adjust'

describe('reportToAdjustment', () => {
  it('moves fire opposite to the miss', () => {
    expect(reportToAdjustment({ over: 50, right: 0 })).toEqual({
      range: -50,
      lateral: 0,
    })
    expect(reportToAdjustment({ over: -30, right: -20 })).toEqual({
      range: 30,
      lateral: 20,
    })
  })

  it('does not produce -0', () => {
    expect(Object.is(reportToAdjustment({ over: 0, right: 0 }).range, 0)).toBe(
      true
    )
  })
})

describe('observerToGun', () => {
  it('is unchanged when the observer stands at the gun', () => {
    expect(observerToGun({ range: -50, lateral: 20 }, 1600, 1600)).toEqual({
      range: -50,
      lateral: 20,
    })
  })

  // The gun fires north (0), the observer looks east (1600).
  it('observer looking east, gun firing north', () => {
    // "Over 50" for the observer: the burst is east of the target →
    // for the gun: the range stays, turn left (west).
    expect(observerToGun({ range: -50, lateral: 0 }, 1600, 0)).toEqual({
      range: 0,
      lateral: -50,
    })
    // "Left 20" for the observer: the burst is north of the target →
    // for the gun: 20 closer.
    expect(observerToGun({ range: 0, lateral: 20 }, 1600, 0)).toEqual({
      range: -20,
      lateral: 0,
    })
  })

  it('observer facing the gun swaps all signs', () => {
    expect(observerToGun({ range: -50, lateral: 20 }, 3200, 0)).toEqual({
      range: 50,
      lateral: -20,
    })
  })

  it('keeps the correction length at any angle', () => {
    const result = observerToGun({ range: 30, lateral: 40 }, 700, 5900)
    expect(Math.hypot(result.range, result.lateral)).toBeCloseTo(50, 1)
  })
})

describe('sumAdjustments', () => {
  it('adds up the history', () => {
    expect(
      sumAdjustments([
        { range: -50, lateral: 20 },
        { range: 10, lateral: -5 },
      ])
    ).toEqual({ range: -40, lateral: 15 })
    expect(sumAdjustments([])).toEqual({ range: 0, lateral: 0 })
  })
})
