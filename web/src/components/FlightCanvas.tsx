import { useEffect, useRef } from 'react'

import { useFlightStyle } from '../lib/animation'
import { getMotion } from '../lib/motion'
import { drawFlight, IMPACT_FX_SECONDS } from '../lib/flightFx'
import type { ShellKind } from '../lib/shellKind'
import type { ArtilleryCategory } from '../types/gameModel'

export interface FlightShot {
  // The moment of the shot, ms (Date.now)
  firedAt: number
  // Time of flight, s
  tof: number
}

/** Where the gun and the target are on the canvas (px) and the arc height. */
export interface FlightEnds {
  ax: number
  ay: number
  bx: number
  by: number
  arc: number
  scale: number
}

interface Props {
  // Shells in flight: a volley has several, flying at the same time
  shots: readonly FlightShot[]
  category: ArtilleryCategory
  kind: ShellKind
  className?: string
  // The canvas over the map: the coordinates come from the map. Without it this is the
  // timer line: the gun on the left, the target on the right, a track with the progress.
  ends?: () => FlightEnds | null
  // Canvas size, px (for the map); the timer line follows the block width
  width?: number
  height?: number
  // Idle: the line without shells (the combat screen always shows it)
  idle?: boolean
  // The red track: the last seconds before impact
  alert?: boolean
}

const TRACK_HEIGHT = 44

// Colours next to the map: the gun is blue, the target red, the track grey, the progress is the accent
const GUN = 'rgba(67,147,228,0.95)'
const TARGET = 'rgba(228,116,116,0.95)'
const TRACK = 'rgba(160,166,173,0.22)'
const ACCENT = 'rgba(67,147,228,0.95)'

/**
 * The timer line and the flight animation in one: a shell travels along the track
 * from the gun to the target (a volley has several), the track fills in as the
 * flight goes on, and there is a burst at the target. The look depends on the weapon and the shell (flightFx);
 * with the animation off only the track with the progress stays.
 */
export function FlightCanvas({
  shots,
  category,
  kind,
  className,
  ends,
  width,
  height = TRACK_HEIGHT,
  idle = false,
  alert = false,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const style = useFlightStyle()
  // Fresh values for the frame loop without restarting it
  const latest = useRef({ category, kind, ends, width, height, style, alert, idle })
  useEffect(() => {
    latest.current = { category, kind, ends, width, height, style, alert, idle }
  })

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    function clear() {
      if (!canvas || !ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    function tick() {
      if (!canvas || !ctx) return
      const { category, kind, ends, width, height, style, alert, idle } = latest.current
      const now = Date.now()
      const cssW = width ?? canvas.clientWidth
      const cssH = height
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
        canvas.width = Math.round(cssW * dpr)
        canvas.height = Math.round(cssH * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)

      let geometry: FlightEnds | null
      if (ends) {
        geometry = ends()
      } else {
        // The timer line: the track at the bottom edge, the shell arc above it
        const ground = cssH - 8
        geometry = {
          ax: 8,
          ay: ground,
          bx: cssW - 10,
          by: ground,
          arc: cssH * 0.55,
          scale: 1,
        }
        ctx.lineCap = 'round'
        ctx.strokeStyle = TRACK
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(geometry.ax, ground)
        ctx.lineTo(geometry.bx, ground)
        ctx.stroke()

        // The progress follows the farthest shell
        const lead = shots.reduce(
          (best, s) => Math.max(best, Math.min(1, (now - s.firedAt) / 1000 / s.tof)),
          0
        )
        if (lead > 0) {
          ctx.strokeStyle = alert ? TARGET : ACCENT
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(geometry.ax, ground)
          ctx.lineTo(geometry.ax + (geometry.bx - geometry.ax) * lead, ground)
          ctx.stroke()
        }
        // The gun is a dot, the target is a ring, as on the map
        ctx.fillStyle = GUN
        ctx.beginPath()
        ctx.arc(geometry.ax, ground, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = TARGET
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(geometry.bx, ground, 4.5, 0, Math.PI * 2)
        ctx.stroke()
      }

      let alive = false
      for (const shot of shots) {
        const elapsed = (now - shot.firedAt) / 1000
        if (elapsed < shot.tof + IMPACT_FX_SECONDS) alive = true
        // The animation is off: only the progress stays on the timer line
        if (geometry && !(style === 'off' && !ends)) {
          drawFlight(ctx, {
            category,
            kind,
            ax: geometry.ax,
            ay: geometry.ay,
            bx: geometry.bx,
            by: geometry.by,
            elapsed,
            tof: shot.tof,
            arc: geometry.arc,
            scale: geometry.scale,
            style: style === 'detailed' ? 'detailed' : 'minimal',
            muzzle: getMotion('fire'),
          })
        }
      }

      if (alive || idle) frame = requestAnimationFrame(tick)
      else clear()
    }

    if (shots.length === 0 && !latest.current.idle) {
      clear()
      return
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clear()
    }
  }, [shots])

  // On the map no canvas is needed with the animation off; the timer line is always needed
  if (style === 'off' && ends) return null

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={width ? { width, height } : { width: '100%', height }}
    />
  )
}
