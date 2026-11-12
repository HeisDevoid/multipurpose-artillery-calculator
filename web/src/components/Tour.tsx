import { t, type MessageKey } from '../i18n'
import { useEffect, useLayoutEffect, useState } from 'react'

import {
  advancedTourDone,
  markAdvancedTourDone,
  markTourDone,
  physicsAsked,
  setPanel,
  tourDone,
  usePanel,
} from '../lib/uiPanels'

interface Step {
  // The element that is highlighted; null: the step is in the middle of the screen
  target: (() => Element | null) | null
  title: MessageKey
  text: MessageKey
}

const byTour = (name: string) => () =>
  document.querySelector(`[data-tour="${name}"]`)
const rowOf = (id: string) => () =>
  document.getElementById(id)?.closest('.row') ?? null
// The whole block of rows (distance, azimuth, target height): all are highlighted
const blockOf = (id: string) => () =>
  document.getElementById(id)?.closest('dl') ?? null

const BASIC: Step[] = [
  {
    target: null,
    title: 'tour.welcome',
    text: 'tour.a-short-tour-of-where',
  },
  {
    // The main thing for accuracy: does the server have shell physics
    target: byTour('settings'),
    title: 'physics.title',
    text: 'tour.physics-text',
  },
  {
    target: byTour('weapon'),
    title: 'tour.weapon-title',
    text: 'tour.weapon-text',
  },
  {
    target: byTour('map'),
    title: 'mapPicker.map',
    text: 'tour.left-click-places-the-gun',
  },
  {
    target: blockOf('calc-distance'),
    title: 'tour.distance-bearing-target-height',
    text: 'tour.these-three-fields-fill-in',
  },
  {
    target: byTour('charge'),
    title: 'artilleryCalculator.charge',
    text: 'tour.fast-picks-the-shortest-flight',
  },
  {
    target: rowOf('calc-own-height'),
    title: 'artilleryCalculator.gun-height',
    text: 'tour.the-lock-keeps-the-height',
  },
  {
    target: byTour('fire'),
    title: 'fireTimer.fire',
    text: 'tour.fire-text',
  },
  {
    target: byTour('settings'),
    title: 'settings.title',
    text: 'tour.optional-sections-live-here-fire',
  },
]

const ADVANCED: Step[] = [
  {
    target: null,
    title: 'footer.advanced-tutorial',
    text: 'tour.maps-the-fire-line-weapon',
  },
  {
    target: byTour('map-select'),
    title: 'tour.choosing-a-map',
    text: 'tour.the-star-adds-a-map',
  },
  {
    target: byTour('zones'),
    title: 'mapPicker.coverage',
    text: 'tour.zones-text',
  },
  {
    target: byTour('map'),
    title: 'tour.terrain-title',
    text: 'tour.terrain-text',
  },
  {
    target: byTour('tools'),
    title: 'mapPicker.fire-line',
    text: 'tour.pick-line-and-drop-points',
  },
  {
    target: byTour('tools'),
    title: 'tour.pinning-the-gun',
    text: 'tour.hold-the-cursor-or-a',
  },
  {
    target: rowOf('calc-own-height'),
    title: 'tour.weapon-and-shell-icons',
    text: 'tour.the-coloured-dot-marks-the',
  },
  {
    target: byTour('settings'),
    title: 'tour.sections-your-way',
    text: 'tour.settings-turn-on-fire-adjustment',
  },
  {
    target: byTour('link'),
    title: 'footer.link',
    text: 'tour.the-fdc-and-gunners-connect',
  },
  {
    target: byTour('hotkeys'),
    title: 'tour.keys-title',
    text: 'tour.keys-text',
  },
  {
    target: null,
    title: 'tour.overlay-title',
    text: 'tour.overlay-text',
  },
  {
    target: byTour('theme'),
    title: 'tour.theme',
    text: 'tour.light-or-dark-in-one',
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
  // The frame margin above and below (no more than PAD)
  padTop: number
  padBottom: number
}

const PAD = 6
// The frame thickness (ring-2), it is drawn outside the highlight
const RING = 2
const CARD_MAX = 352
const GAP = 12

/**
 * The borders of the highlight: for a list row they follow its content (the label and
 * the fields), not the full row height. A field in two lines (the "105 mm [HE]" shell
 * on a phone) stretches the row, and the neighbour's frame overlapped it.
 */
function contentBox(element: Element) {
  const box = element.getBoundingClientRect()
  if (!element.classList.contains('row')) return { top: box.top, bottom: box.bottom }
  const parts = [...element.querySelectorAll(':scope > dt, :scope > dd > *')]
    .map((part) => part.getBoundingClientRect())
    .filter((r) => r.height > 0)
  if (parts.length === 0) return { top: box.top, bottom: box.bottom }
  return { top: Math.min(...parts.map((r) => r.top)), bottom: Math.max(...parts.map((r) => r.bottom)) }
}

/** The frame margin: PAD, but the frame must not reach the neighbouring rows. */
function padsOf(element: Element) {
  const own = contentBox(element)
  const box = element.getBoundingClientRect()
  let top = PAD
  let bottom = PAD
  const prev = element.previousElementSibling
  const next = element.nextElementSibling
  if (prev) {
    const above = contentBox(prev).bottom
    if (above <= own.top + 1) top = Math.max(0, Math.min(PAD, own.top - above - RING - 1))
  }
  if (next) {
    const below = contentBox(next).top
    if (below >= own.bottom - 1) bottom = Math.max(0, Math.min(PAD, below - own.bottom - RING - 1))
  }
  // The margins are measured from the content: convert them to margins from the row itself
  return { padTop: top - (own.top - box.top), padBottom: bottom - (box.bottom - own.bottom) }
}

/**
 * The tutorial: the basic one on the first start, the advanced one after the basic.
 * It highlights elements, and any tour can be skipped. The highlight and the card
 * glide smoothly from step to step.
 */
export function Tour() {
  const basicOpen = usePanel('tour')
  const advancedOpen = usePanel('tourAdvanced')
  const open = basicOpen || advancedOpen
  const steps = advancedOpen ? ADVANCED : BASIC

  const [index, setIndex] = useState(0)
  // The last measured highlight: it stays during a step change until the new one arrives
  const [measured, setMeasured] = useState<Rect | null>(null)
  const [cardH, setCardH] = useState(200)
  const [viewport, setViewport] = useState(() => ({
    w: typeof window === 'undefined' ? 1200 : window.innerWidth,
    h: typeof window === 'undefined' ? 800 : window.innerHeight,
  }))
  // The offer of the advanced tutorial after the basic one
  const [offer, setOffer] = useState(false)
  const [cardNode, setCardNode] = useState<HTMLDivElement | null>(null)

  // On the first start the basic tutorial opens by itself
  // (if the server physics question has not been asked yet, the tutorial opens after the answer)
  useEffect(() => {
    if (tourDone() || !physicsAsked()) return
    const timer = window.setTimeout(() => setPanel('tour', true), 800)
    return () => window.clearTimeout(timer)
  }, [])

  // Steps without an element on the screen (the map is off, no solution) are skipped
  const available = open
    ? steps.filter((s) => s.target === null || s.target() !== null)
    : []
  const step = available[Math.min(index, available.length - 1)]

  function finish(completed: boolean) {
    const advanced = advancedOpen
    if (advanced) markAdvancedTourDone()
    else markTourDone()
    setPanel('tour', false)
    setPanel('tourAdvanced', false)
    setIndex(0)
    setMeasured(null)
    // The basic one is finished: offer the advanced one
    if (completed && !advanced && !advancedTourDone()) setOffer(true)
  }

  useEffect(() => {
    if (!open && !offer) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (offer) setOffer(false)
      else finish(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // The card height: to place it above or below the highlight at exact coordinates
  useEffect(() => {
    if (!cardNode) return
    const observer = new ResizeObserver(() => setCardH(cardNode.offsetHeight))
    observer.observe(cardNode)
    return () => observer.disconnect()
  }, [cardNode])

  // The highlight: scroll to the element and follow its position
  useLayoutEffect(() => {
    if (!open || !step) return
    const element = step.target?.() ?? null
    element?.scrollIntoView({ block: 'center', behavior: 'instant' })
    function measure() {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      if (!element) {
        setMeasured(null)
        return
      }
      const r = element.getBoundingClientRect()
      setMeasured({ top: r.top, left: r.left, width: r.width, height: r.height, ...padsOf(element) })
    }
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  if (offer && !open) {
    return (
      <div
        className="tour-fade-always fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="panel w-full max-w-sm p-5 shadow-2xl">
          <h2 className="text-lg font-semibold text-app-text">
            {t('tour.basic-tutorial-complete')}
          </h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
            {t('tour.want-the-advanced-one-it')}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost text-app-muted" onClick={() => setOffer(false)}>
              {t('tour.not-now')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setOffer(false)
                setIndex(0)
                setPanel('tourAdvanced', true)
              }}
            >
              {t('tour.show-me')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!open || !step) return null

  const last = index >= available.length - 1
  const cardW = Math.min(CARD_MAX, viewport.w - 32)

  // The highlight: without an element it is a collapsed dot in the centre (the dimming stays)
  const spot = measured ?? {
    top: viewport.h / 2,
    left: viewport.w / 2,
    width: 0,
    height: 0,
  }
  const pad = measured ? PAD : 0
  const padTop = measured ? measured.padTop : 0
  const padBottom = measured ? measured.padBottom : 0

  // The card: under the highlight if it fits, else above; without an element in the centre
  let cardTop: number
  let cardLeft: number
  if (measured) {
    const below = measured.top + measured.height + padBottom + GAP
    cardTop =
      below + cardH + 12 <= viewport.h
        ? below
        : measured.top - padTop - GAP - cardH
    cardTop = Math.min(Math.max(12, cardTop), viewport.h - cardH - 12)
    cardLeft = Math.min(Math.max(16, measured.left), viewport.w - cardW - 16)
  } else {
    cardTop = (viewport.h - cardH) / 2
    cardLeft = (viewport.w - cardW) / 2
  }

  const move =
    'keep-motion transition-[top,left,width,height,opacity] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]'

  return (
    <div
      className="tour-fade-always fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t('footer.tutorial')}
    >
      <div
        className={`pointer-events-none absolute rounded-lg ${measured ? 'ring-2 ring-accent' : ''} ${move}`}
        style={{
          top: spot.top - padTop,
          left: spot.left - pad,
          width: spot.width + pad * 2,
          height: spot.height + padTop + padBottom,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
        }}
      />

      <div
        ref={setCardNode}
        className={`panel absolute p-4 shadow-2xl ${move}`}
        style={{ width: cardW, top: cardTop, left: cardLeft }}
      >
        {/* The text changes with a short fade-in while the card glides */}
        <div key={`${advancedOpen ? 'a' : 'b'}:${step.title}`} className="tour-fade-always">
          <p className="label mb-1">
            {advancedOpen ? (t('tour.advanced')) : ''}
            {index + 1} / {available.length}
          </p>
          <h2 className="text-lg font-semibold text-app-text">{t(step.title)}</h2>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-app-text-2">
            {t(step.text)}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" className="btn btn-ghost text-app-muted" onClick={() => finish(false)}>
            {t('tour.skip')}
          </button>
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button type="button" className="btn" onClick={() => setIndex(index - 1)}>
                {t('app.back')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => (last ? finish(true) : setIndex(index + 1))}
            >
              {last ? (t('tour.done')) : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
