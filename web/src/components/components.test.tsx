// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { solveAllCharges, type ChargeResult } from '../lib/ballistics'
import { artilleryRegistry } from '../data/artillery/registry'
import { AnimatedNumber } from './AnimatedNumber'
import { ChargeStrip } from './ChargeStrip'
import { Dropdown } from './Dropdown'
import { Row, Toggle } from './FormControls'

beforeAll(() => {
  // jsdom cannot do this, but the components call it
  Element.prototype.scrollIntoView = () => {}
  class RO {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', RO)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})
afterEach(cleanup)

describe('Dropdown', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo', description: 'second' },
    { value: 'c', label: 'Charlie', disabled: true },
  ]

  it('shows the selected item and selects on click', () => {
    const onChange = vi.fn()
    render(<Dropdown label="Choice" value="a" options={options} onChange={onChange} />)
    const button = screen.getByRole('button', { name: 'Choice' })
    expect(button).toHaveTextContent('Alpha')
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('option', { name: /Bravo/ }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('works with the arrow keys and Enter, Escape closes it', () => {
    const onChange = vi.fn()
    render(<Dropdown label="Choice" value="a" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choice' }))
    const list = screen.getByRole('listbox')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('b')

    fireEvent.click(screen.getByRole('button', { name: 'Choice' }))
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('does not select disabled items', () => {
    const onChange = vi.fn()
    render(<Dropdown label="Choice" value="a" options={options} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Choice' }))
    fireEvent.click(screen.getByRole('option', { name: /Charlie/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows each group heading once per group', () => {
    render(
      <Dropdown
        label="Map"
        value="x"
        onChange={() => {}}
        options={[
          { value: 'x', label: 'X', group: 'Official' },
          { value: 'y', label: 'Y', group: 'Official' },
          { value: 'z', label: 'Z', group: 'Community' },
        ]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(screen.getAllByText('Official')).toHaveLength(1)
    expect(screen.getAllByText('Community')).toHaveLength(1)
  })

  it('a button inside a row does not select the item (the favourite star)', () => {
    const onChange = vi.fn()
    const star = vi.fn()
    render(
      <Dropdown
        label="Map"
        value="x"
        onChange={onChange}
        options={[
          {
            value: 'y',
            label: 'Y',
            trailing: (
              <button
                aria-label="star"
                onClick={(e) => {
                  e.stopPropagation()
                  star()
                }}
              />
            ),
          },
        ]}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    fireEvent.click(screen.getByRole('button', { name: 'star' }))
    expect(star).toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Toggle and Row', () => {
  it('Toggle marks the selected item and calls onChange', () => {
    const onChange = vi.fn()
    render(
      <Toggle
        label="Mode"
        value="HIGH"
        onChange={onChange}
        options={[
          { value: 'HIGH', label: 'High' },
          { value: 'LOW', label: 'Low' },
        ]}
      />
    )
    expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Low' }))
    expect(onChange).toHaveBeenCalledWith('LOW')
  })

  it('Row with a unit shows it to the right of the control', () => {
    render(
      <dl>
        <Row label="Distance" control="unit" unit="m">
          <input aria-label="d" />
        </Row>
      </dl>
    )
    expect(screen.getByText('Distance')).toBeInTheDocument()
    expect(screen.getByText('m')).toBeInTheDocument()
  })
})

describe('AnimatedNumber', () => {
  it('shows a dash without a value and the number with one', () => {
    const { rerender } = render(<AnimatedNumber value={null} />)
    expect(screen.getByText('-')).toBeInTheDocument()
    rerender(<AnimatedNumber value={1043.4} />)
    return waitFor(() => expect(screen.getByText('1043')).toBeInTheDocument())
  })

  it('rolls to the new value and uses the format', async () => {
    const { rerender, container } = render(
      <AnimatedNumber value={10} format={(v) => v.toFixed(1)} duration={40} />
    )
    await waitFor(() => expect(container).toHaveTextContent('10.0'))
    rerender(<AnimatedNumber value={20} format={(v) => v.toFixed(1)} duration={40} />)
    await waitFor(() => expect(container).toHaveTextContent('20.0'))
  })

  it('a large jump (an azimuth through zero) is not animated', async () => {
    const { rerender, container } = render(<AnimatedNumber value={6200} maxTween={3000} duration={400} />)
    await waitFor(() => expect(container).toHaveTextContent('6200'))
    rerender(<AnimatedNumber value={50} maxTween={3000} duration={400} />)
    await waitFor(() => expect(container).toHaveTextContent('50'))
    expect(container).not.toHaveTextContent('3')
  })
})

describe('ChargeStrip', () => {
  const profile = artilleryRegistry.m101.profiles?.['default'] ?? Object.values(artilleryRegistry.m101.profiles ?? {})[0]

  function results(range: number): ChargeResult[] {
    if (!profile) throw new Error('no M101 profile')
    return solveAllCharges(profile, 'HIGH', undefined, range, 0)
  }

  it('shows all charges, the selected one is marked, unavailable ones are disabled', () => {
    const onPick = vi.fn()
    const list = results(3000)
    render(
      <ChargeStrip
        groups={[{ mode: 'HIGH', label: 'High', results: list }]}
        activeMode="HIGH"
        activeCharge={list.find((r) => r.solution)?.charge ?? null}
        onPick={onPick}
      />
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(list.length)
    const usable = list.filter((r) => r.solution)
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    expect(buttons.filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(list.length - usable.length)

    const first = buttons.find((b) => !(b as HTMLButtonElement).disabled)!
    fireEvent.click(first)
    expect(onPick).toHaveBeenCalledWith('HIGH', usable[0].charge)
  })

  it('labels the groups when there are several trajectories', () => {
    const list = results(3000)
    render(
      <ChargeStrip
        groups={[
          { mode: 'HIGH', label: 'High trajectory', results: list },
          { mode: 'LOW', label: 'Low trajectory', results: list },
        ]}
        activeMode="HIGH"
        activeCharge={null}
        onPick={() => {}}
      />
    )
    expect(screen.getByText('High trajectory')).toBeInTheDocument()
    expect(screen.getByText('Low trajectory')).toBeInTheDocument()
  })

  it('a choice in another trajectory reports the mode too', () => {
    const list = results(3000)
    const onPick = vi.fn()
    render(
      <ChargeStrip
        groups={[
          { mode: 'HIGH', label: 'H', results: list },
          { mode: 'LOW', label: 'L', results: list },
        ]}
        activeMode="HIGH"
        activeCharge={null}
        onPick={onPick}
      />
    )
    const low = screen.getByText('L').parentElement!
    const enabled = within(low).getAllByRole('button').find((b) => !(b as HTMLButtonElement).disabled)
    expect(enabled).toBeTruthy()
    act(() => {
      fireEvent.click(enabled!)
    })
    expect(onPick.mock.calls[0][0]).toBe('LOW')
  })
})

describe('FlightTrack', () => {
  it('idle: a short strip without progress; in flight it expands', async () => {
    const { FlightTrack } = await import('./FlightTrack')
    const { container, rerender } = render(<FlightTrack shots={[]} />)
    const bar = container.firstElementChild as HTMLElement
    expect(bar.style.width).toBe('1.25rem')
    rerender(<FlightTrack shots={[{ firedAt: Date.now(), tof: 30 }]} />)
    await waitFor(() => expect(bar.style.width).not.toBe('1.25rem'))
    expect(bar.querySelectorAll('span').length).toBeGreaterThan(1)
  })
})

describe('FireTimer: volley', () => {
  it('"+ shell" appears only with the option on and only in flight', async () => {
    const { FireTimer } = await import('./FireTimer')
    const { setFeature } = await import('../lib/features')
    const { setLanguage } = await import('../i18n')
    setLanguage('en')
    setFeature('volley', false)
    const view = render(<FireTimer tof={20} variant="bar" />)
    fireEvent.click(screen.getByRole('button', { name: /Fire/ }))
    expect(screen.queryByRole('button', { name: /shell/ })).toBeNull()
    view.unmount()

    act(() => setFeature('volley', true))
    const onShots = vi.fn()
    render(<FireTimer tof={20} variant="bar" onShotChange={onShots} />)
    // no button before the shot
    expect(screen.queryByRole('button', { name: /shell/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Fire/ }))
    const add = await screen.findByRole('button', { name: /shell/ })
    fireEvent.click(add)
    await waitFor(() => expect(onShots.mock.calls.at(-1)?.[0]).toHaveLength(2))
    expect(screen.getByText(/×2/)).toBeTruthy()
    // "Fire again" starts over with a single shell
    fireEvent.click(screen.getByRole('button', { name: /Fire again/ }))
    await waitFor(() => expect(onShots.mock.calls.at(-1)?.[0]).toHaveLength(1))
    // "Stop" removes them all
    fireEvent.click(screen.getByRole('button', { name: /Stop/ }))
    await waitFor(() => expect(onShots.mock.calls.at(-1)?.[0]).toHaveLength(0))
    setFeature('volley', false)
  })
})
