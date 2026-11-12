// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { artilleryRegistry } from '../data/artillery/registry'
import { setLanguage } from '../i18n'
import { readErrors, recordError } from '../lib/errorLog'
import { DataStatusBadge } from './DataStatusBadge'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ message = 'boom' }: { message?: string }): never {
  throw new Error(message)
}

beforeEach(() => {
  localStorage.clear()
  setLanguage('en')
  // React logs a caught error to the console: noise in tests
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('shows a message instead of a white screen and logs the error', () => {
    render(
      <ErrorBoundary area="test">
        <Boom message="broken in a test" />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    expect(screen.getByText('broken in a test')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument()
    const log = readErrors()
    expect(log).toHaveLength(1)
    expect(log[0].area).toBe('test')
    expect(log[0].message).toBe('broken in a test')
  })

  it('block card: "Try again" shows the content again', () => {
    let fail = true
    function Flaky() {
      if (fail) throw new Error('flaky')
      return <p>the map is in place</p>
    }
    render(
      <ErrorBoundary area="map" variant="inline">
        <Flaky />
      </ErrorBoundary>
    )
    expect(screen.getByText('The map did not open')).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(screen.getByText('the map is in place')).toBeInTheDocument()
  })

  it('the "Report a problem" link leads to issues with the error text', () => {
    render(
      <ErrorBoundary area="test">
        <Boom message="link" />
      </ErrorBoundary>
    )
    const link = screen.getByRole('link', { name: /Report a problem/ })
    expect(link.getAttribute('href')).toContain('/issues/new?title=')
    expect(decodeURIComponent(link.getAttribute('href')!)).toContain('link')
  })
})

describe('error log', () => {
  it('keeps no more than the last 10 entries', () => {
    for (let i = 0; i < 15; i += 1) recordError('test', new Error(`e${i}`))
    const log = readErrors()
    expect(log).toHaveLength(10)
    expect(log[0].message).toBe('e5')
    expect(log[9].message).toBe('e14')
  })
})

describe('DataStatusBadge', () => {
  it('verified and unverified tables differ in the badge and the tooltip', () => {
    render(
      <>
        <DataStatusBadge status="verified" />
        <DataStatusBadge status="in-progress" />
      </>
    )
    const badges = screen.getAllByRole('img')
    expect(badges[0]).toHaveAttribute('data-status', 'verified')
    expect(badges[0].getAttribute('aria-label')).toMatch(/verified in game/)
    expect(badges[1].getAttribute('aria-label')).toMatch(/not verified in game/)
    expect(badges[1].getAttribute('aria-label')).toMatch(/shots may miss/)
  })

  it('every weapon has a table verification status', () => {
    for (const reference of Object.values(artilleryRegistry)) {
      expect(['pending', 'in-progress', 'verified']).toContain(reference.source.status)
    }
  })
})
