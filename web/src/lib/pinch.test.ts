import { describe, expect, it } from 'vitest'
import { pinchView } from './pinch'

const start = { x0: 1000, y0: 5000, scale: 0.5 }

/** World point under a canvas pixel. */
const worldAt = (view: { x0: number; y0: number; scale: number }, x: number, y: number) => ({
  x: view.x0 + x / view.scale,
  y: view.y0 - y / view.scale,
})

describe('pinchView', () => {
  it('zooms in by the ratio of finger spreads', () => {
    const view = pinchView(start, [{ x: 100, y: 200 }, { x: 200, y: 200 }], [{ x: 50, y: 200 }, { x: 250, y: 200 }], 0.01, 4)
    expect(view.scale).toBeCloseTo(1)
  })

  it('keeps the world point between the fingers in place', () => {
    const view = pinchView(start, [{ x: 100, y: 200 }, { x: 200, y: 300 }], [{ x: 40, y: 140 }, { x: 260, y: 360 }], 0.01, 4)
    const before = worldAt(start, 150, 250)
    const after = worldAt(view, 150, 250)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })

  it('drags the map when both fingers move together', () => {
    const view = pinchView(start, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 130, y: 160 }, { x: 230, y: 160 }], 0.01, 4)
    expect(view.scale).toBeCloseTo(start.scale)
    // 30 px right and 60 px down at 0.5 px/m: the view moves 60 m west and 120 m north
    expect(view.x0).toBeCloseTo(start.x0 - 60)
    expect(view.y0).toBeCloseTo(start.y0 + 120)
  })

  it('stops at the scale limits', () => {
    const wide: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 1000, y: 0 }]
    const tight: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 495, y: 0 }, { x: 505, y: 0 }]
    expect(pinchView(start, tight, wide, 0.1, 4).scale).toBe(4)
    expect(pinchView(start, wide, tight, 0.1, 4).scale).toBe(0.1)
  })

  it('survives fingers that start on the same pixel', () => {
    const same = { x: 50, y: 50 }
    const view = pinchView(start, [same, same], [{ x: 40, y: 50 }, { x: 80, y: 50 }], 0.01, 4)
    expect(Number.isFinite(view.scale)).toBe(true)
    expect(view.scale).toBe(start.scale)
  })
})
