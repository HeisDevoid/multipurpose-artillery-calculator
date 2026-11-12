// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setFlightOnMap, setFlightStyle, useFlightOnMap, useFlightStyle } from './animation'
import { setFeature, useFeature } from './features'
import { setPanel, tourDone, markTourDone, usePanel, togglePanel } from './uiPanels'

beforeEach(() => {
  localStorage.clear()
})
afterEach(cleanup)

describe('features', () => {
  it('sections are off and hints are on by default', () => {
    const { result } = renderHook(() => ({
      adjust: useFeature('adjust'),
      journal: useFeature('journal'),
      hints: useFeature('hints'),
    }))
    expect(result.current).toEqual({ adjust: false, journal: false, hints: true })
  })

  it('a switch is seen by all subscribers and is saved', () => {
    const a = renderHook(() => useFeature('weather'))
    const b = renderHook(() => useFeature('weather'))
    act(() => setFeature('weather', true))
    expect(a.result.current).toBe(true)
    expect(b.result.current).toBe(true)
    expect(localStorage.getItem('feature:weather')).toBe('on')
    act(() => setFeature('weather', false))
    expect(a.result.current).toBe(false)
  })

  it('hints can be turned off', () => {
    const { result } = renderHook(() => useFeature('hints'))
    act(() => setFeature('hints', false))
    expect(result.current).toBe(false)
    expect(localStorage.getItem('feature:hints')).toBe('off')
  })
})

describe('animation', () => {
  it('minimal and on the map by default', () => {
    const { result } = renderHook(() => ({
      style: useFlightStyle(),
      onMap: useFlightOnMap(),
    }))
    expect(result.current).toEqual({ style: 'minimal', onMap: true })
  })

  it('the style and the map display switch and are remembered', () => {
    const { result } = renderHook(() => ({
      style: useFlightStyle(),
      onMap: useFlightOnMap(),
    }))
    act(() => {
      setFlightStyle('detailed')
      setFlightOnMap(false)
    })
    expect(result.current).toEqual({ style: 'detailed', onMap: false })
    expect(localStorage.getItem('flightAnim')).toBe('detailed')
    expect(localStorage.getItem('flightAnimMap')).toBe('off')
    act(() => setFlightStyle('off'))
    expect(result.current.style).toBe('off')
  })
})

describe('uiPanels', () => {
  it('panels open, close and switch', () => {
    const { result } = renderHook(() => usePanel('hotkeys'))
    expect(result.current).toBe(false)
    act(() => setPanel('hotkeys', true))
    expect(result.current).toBe(true)
    act(() => togglePanel('hotkeys'))
    expect(result.current).toBe(false)
  })

  it('the tutorial remembers that it was finished', () => {
    expect(tourDone()).toBe(false)
    markTourDone()
    expect(tourDone()).toBe(true)
  })
})

describe('motion', () => {
  it('each animation is turned on separately, the choice is marked on <html>', async () => {
    const { getMotion, setMotion, useMotion, MOTION_KINDS } = await import('./motion')
    const numbers = renderHook(() => useMotion('numbers'))
    const switches = renderHook(() => useMotion('switches'))
    expect(MOTION_KINDS).toHaveLength(6)
    expect(numbers.result.current).toBe(true)
    act(() => setMotion('numbers', false))
    expect(numbers.result.current).toBe(false)
    // the others are not affected
    expect(switches.result.current).toBe(true)
    expect(getMotion('smooth')).toBe(true)
    expect(document.documentElement.getAttribute('data-m-numbers')).toBe('off')
    expect(document.documentElement.getAttribute('data-m-switches')).toBe('on')
    expect(localStorage.getItem('motion:numbers')).toBe('off')
    act(() => setMotion('numbers', true))
    expect(document.documentElement.getAttribute('data-m-numbers')).toBe('on')
  })
})

describe('timerSound', () => {
  it('sound is on by default and switches', async () => {
    const { setTimerSound, useTimerSound } = await import('./timerSound')
    const { result } = renderHook(() => useTimerSound())
    expect(result.current).toBe(true)
    act(() => setTimerSound(false))
    expect(result.current).toBe(false)
    expect(localStorage.getItem('timerSound')).toBe('off')
    act(() => setTimerSound(true))
  })
})

describe('favorites', () => {
  it('adds and removes, remembers between visits', async () => {
    const { useFavorites } = await import('./favorites')
    const first = renderHook(() => useFavorites('favTest'))
    act(() => first.result.current[1]('a'))
    act(() => first.result.current[1]('b'))
    expect(first.result.current[0]).toEqual(['a', 'b'])
    act(() => first.result.current[1]('a'))
    expect(first.result.current[0]).toEqual(['b'])
    const again = renderHook(() => useFavorites('favTest'))
    expect(again.result.current[0]).toEqual(['b'])
  })

  it('junk in storage does not break the list', async () => {
    const { useFavorites } = await import('./favorites')
    localStorage.setItem('favBroken', '{not json')
    expect(renderHook(() => useFavorites('favBroken')).result.current[0]).toEqual([])
    localStorage.setItem('favMixed', JSON.stringify(['x', 5, null, 'y']))
    expect(renderHook(() => useFavorites('favMixed')).result.current[0]).toEqual(['x', 'y'])
  })
})
