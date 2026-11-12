import type { ArtilleryCategory } from '../types/gameModel'
import type { ShellKind } from './shellKind'

/**
 * The shell flight animation on a canvas: the trajectory, the trail and the burst depend
 * on the weapon class and the shell kind. It is drawn from the side (the strip at the timer)
 * and "from above" (on the map): the impact point is on the ground, the shell is raised above
 * its shadow by the arc height.
 */

// How long to show the burst aftermath after the shell lands, s
export const IMPACT_FX_SECONDS = 4

export interface FlightParams {
  category: ArtilleryCategory
  kind: ShellKind
  // The gun and the target on the ground, canvas px
  ax: number
  ay: number
  bx: number
  by: number
  // Seconds since the shot and the time of flight
  elapsed: number
  tof: number
  // The height of the arc top, px
  arc: number
  // The effect scale (1 is the strip at the timer)
  scale?: number
  // The muzzle flash at the moment of the shot
  muzzle?: boolean
  // minimal: thin lines and rings (the default), detailed: a fireball, sparks, a parachute
  style?: 'minimal' | 'detailed'
}

// A pseudo-random number from an integer: so that sparks and puffs do not jitter between frames
function rnd(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The arc height share by class: a mortar fires high, an MLRS flatter. */
function lift(category: ArtilleryCategory, t: number): number {
  const parabola = 4 * t * (1 - t)
  switch (category) {
    case 'mortar':
      return parabola
    case 'mlrs':
      return Math.pow(parabola, 0.7) * 0.55
    default:
      return parabola * 0.6
  }
}

function pathPoint(p: FlightParams, t: number) {
  const gx = p.ax + (p.bx - p.ax) * t
  const gy = p.ay + (p.by - p.ay) * t
  return { gx, gy, x: gx, y: gy - p.arc * lift(p.category, t) }
}


const INK = '240,244,248'
// The target colour on the map: the minimal burst is drawn in it
const TARGET = '228,116,116'

// A short trail behind the shell: points along the path travelled, fading
function drawTrail(ctx: CanvasRenderingContext2D, p: FlightParams, t: number, s: number) {
  const length = p.category === 'mlrs' ? 0.3 : p.category === 'mortar' ? 0.22 : 0.12
  const steps = 16
  for (let i = 0; i < steps; i += 1) {
    const u0 = Math.max(0, t - length * (1 - i / steps))
    const u1 = Math.max(0, t - length * (1 - (i + 1) / steps))
    const a = pathPoint(p, u0)
    const b = pathPoint(p, u1)
    const k = (i + 1) / steps
    // A mortar has a dashed trail, the rest a thin solid one
    if (p.category === 'mortar' && i % 2 === 1) continue
    ctx.strokeStyle = `rgba(${INK},${0.55 * k})`
    ctx.lineWidth = (p.category === 'mlrs' ? 0.6 + k * 1.6 : 1.2) * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, p: FlightParams, t: number, s: number) {
  const now = pathPoint(p, t)
  // The shadow on the ground shows the height
  if (p.arc > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.ellipse(now.gx, now.gy, 3 * s, 1.2 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = `rgb(${INK})`
  ctx.beginPath()
  ctx.arc(now.x, now.y, (p.category === 'mortar' ? 2.6 : 2.1) * s, 0, Math.PI * 2)
  ctx.fill()
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, width: number, color: string) {
  if (alpha <= 0) return
  ctx.strokeStyle = `rgba(${color},${alpha})`
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
}

function drawHe(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  const radius = (p.category === 'mortar' ? 12 : p.category === 'mlrs' ? 18 : 15) * s
  // Rockets: a salvo of three bursts
  const blasts = p.category === 'mlrs' ? 3 : 1
  for (let i = 0; i < blasts; i += 1) {
    const local = e - i * 0.2
    if (local < 0) continue
    const cx = p.bx + (blasts > 1 ? (rnd(i + 1) - 0.5) * radius * 1.6 : 0)
    const cy = p.by + (blasts > 1 ? (rnd(i + 7) - 0.5) * radius * 0.6 : 0)
    // A flash in the centre and two spreading rings
    const flash = clamp01(1 - local / 0.2)
    if (flash > 0) {
      ctx.fillStyle = `rgba(${TARGET},${flash})`
      ctx.beginPath()
      ctx.arc(cx, cy, 3.5 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    const k1 = clamp01(local / 0.7)
    ring(ctx, cx, cy, radius * (0.2 + k1 * 0.8), (1 - k1) * 0.9, 1.6 * s, TARGET)
    const k2 = clamp01((local - 0.12) / 1.1)
    if (local > 0.12) ring(ctx, cx, cy, radius * (0.2 + k2 * 1.15), (1 - k2) * 0.5, 1 * s, INK)
  }
}

function drawIllum(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  // A bright dot opens over the target and slowly descends, a soft glow
  const cx = p.bx
  const cy = p.by - 30 * s + e * 3 * s
  const fade = clamp01(1 - (e - 2.6) / 1.4)
  const open = clamp01(e / 0.35)
  const r = 40 * s * (0.4 + open * 0.6)
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, `rgba(255,244,200,${0.55 * fade})`)
  g.addColorStop(1, 'rgba(255,230,150,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${fade})`
  ctx.beginPath()
  ctx.arc(cx, cy, 2.2 * s, 0, Math.PI * 2)
  ctx.fill()
}

function drawSmoke(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  // Three soft puffs slowly spread and fade
  const grow = clamp01(e / 2.4)
  const alpha = 0.4 * clamp01(e / 0.3) * (1 - clamp01((e - 2.8) / 1.2))
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.6
    const d = 7 * s * grow
    const x = p.bx + Math.cos(a) * d
    const y = p.by + Math.sin(a) * d * 0.55 - e * 1.2 * s
    const r = (6 + i * 1.5) * s * (0.5 + grow)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(${INK},${alpha})`)
    g.addColorStop(1, `rgba(${INK},0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

// ---- the detailed variant: a fireball, sparks, a parachute ----

function drawTrailD(ctx: CanvasRenderingContext2D, p: FlightParams, t: number, s: number) {
  const length = p.category === 'mortar' ? 0.12 : p.category === 'mlrs' ? 0.38 : 0.16
  const steps = 18
  for (let i = 0; i < steps; i += 1) {
    const u0 = Math.max(0, t - length * (1 - i / steps))
    const u1 = Math.max(0, t - length * (1 - (i + 1) / steps))
    const a = pathPoint(p, u0)
    const b = pathPoint(p, u1)
    const k = (i + 1) / steps
    ctx.lineCap = 'round'
    if (p.category === 'mlrs') {
      // The smoke trail widens towards the tail
      ctx.strokeStyle = `rgba(235,235,235,${0.55 * k})`
      ctx.lineWidth = (1.5 + (1 - k) * 4) * s
    } else if (p.category === 'mortar') {
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * k})`
      ctx.lineWidth = 1.2 * s
    } else {
      // The artillery shell tracer
      ctx.strokeStyle = `rgba(255,196,64,${0.9 * k})`
      ctx.lineWidth = 2.2 * s
    }
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}

function drawProjectileD(ctx: CanvasRenderingContext2D, p: FlightParams, t: number, s: number) {
  const now = pathPoint(p, t)
  const next = pathPoint(p, Math.min(1, t + 0.01))
  const angle = Math.atan2(next.y - now.y, next.x - now.x)

  // The shadow on the ground: shows that the shell is above the ground
  if (p.arc > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(now.gx, now.gy, 3.5 * s, 1.6 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.translate(now.x, now.y)
  ctx.rotate(angle)
  if (p.category === 'mlrs') {
    // A rocket with a flame behind
    const flame = ctx.createRadialGradient(-5 * s, 0, 0, -5 * s, 0, 7 * s)
    flame.addColorStop(0, 'rgba(255,230,140,0.95)')
    flame.addColorStop(1, 'rgba(255,120,20,0)')
    ctx.fillStyle = flame
    ctx.beginPath()
    ctx.arc(-5 * s, 0, 7 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f2f2f2'
    ctx.fillRect(-4 * s, -1.6 * s, 8 * s, 3.2 * s)
    ctx.beginPath()
    ctx.moveTo(4 * s, -1.6 * s)
    ctx.lineTo(7 * s, 0)
    ctx.lineTo(4 * s, 1.6 * s)
    ctx.fill()
  } else if (p.category === 'mortar') {
    // A mortar bomb: a body with fins
    ctx.fillStyle = '#d9d9d9'
    ctx.beginPath()
    ctx.ellipse(0, 0, 3.6 * s, 2.2 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#d9d9d9'
    ctx.lineWidth = 1.2 * s
    ctx.beginPath()
    ctx.moveTo(-3 * s, 0)
    ctx.lineTo(-6 * s, 0)
    ctx.moveTo(-5 * s, -2 * s)
    ctx.lineTo(-6.5 * s, 2 * s)
    ctx.stroke()
  } else {
    // A shell: the bright head of the tracer
    ctx.fillStyle = '#fff3c4'
    ctx.beginPath()
    ctx.ellipse(0, 0, 4 * s, 1.8 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawHeD(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  const radius = (p.category === 'mortar' ? 13 : p.category === 'mlrs' ? 20 : 17) * s
  // Rockets: a salvo of several bursts
  const blasts = p.category === 'mlrs' ? 3 : 1
  for (let i = 0; i < blasts; i += 1) {
    const local = e - i * 0.18
    if (local < 0) continue
    const ox = blasts > 1 ? (rnd(i + 1) - 0.5) * radius * 1.6 : 0
    const oy = blasts > 1 ? (rnd(i + 7) - 0.5) * radius * 0.8 : 0
    const cx = p.bx + ox
    const cy = p.by + oy

    // Flash
    const flash = clamp01(1 - local / 0.25)
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,220,${flash})`
      ctx.beginPath()
      ctx.arc(cx, cy, radius * (0.4 + local * 2), 0, Math.PI * 2)
      ctx.fill()
    }
    // Fireball
    const fire = clamp01(1 - local / 0.9)
    if (fire > 0) {
      const r = radius * (0.5 + clamp01(local / 0.35) * 0.7)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      g.addColorStop(0, `rgba(255,220,120,${fire})`)
      g.addColorStop(0.55, `rgba(255,110,20,${fire * 0.85})`)
      g.addColorStop(1, 'rgba(120,30,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
    }
    // Sparks
    const spark = clamp01(1 - local / 0.8)
    if (spark > 0) {
      ctx.strokeStyle = `rgba(255,200,90,${spark})`
      ctx.lineWidth = 1.5 * s
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2 + rnd(k) * 0.5
        const r0 = radius * (0.6 + local * 1.2)
        const r1 = r0 + radius * 0.5 * (0.5 + rnd(k + 3))
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
        ctx.stroke()
      }
    }
    // Lingering smoke
    const smoke = clamp01(1 - local / IMPACT_FX_SECONDS) * 0.35 * clamp01(local / 0.3)
    if (smoke > 0) {
      ctx.fillStyle = `rgba(90,90,90,${smoke})`
      ctx.beginPath()
      ctx.arc(cx, cy - local * 4 * s, radius * (0.7 + local * 0.25), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawIllumD(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  // It opens high above the impact point, then slowly descends on a parachute
  const cx = p.bx
  const height = 34 * s
  const cy = p.by - height + e * 3 * s
  const fade = clamp01(1 - (e - 2.8) / 1.2)
  const flash = clamp01(1 - e / 0.3)
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,240,${flash})`
    ctx.beginPath()
    ctx.arc(cx, cy, 22 * s * (0.4 + e * 2), 0, Math.PI * 2)
    ctx.fill()
  }
  const pulse = 1 + Math.sin(e * 9) * 0.05
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 46 * s * pulse)
  g.addColorStop(0, `rgba(255,250,210,${0.9 * fade})`)
  g.addColorStop(0.35, `rgba(255,226,140,${0.4 * fade})`)
  g.addColorStop(1, 'rgba(255,200,80,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, 46 * s * pulse, 0, Math.PI * 2)
  ctx.fill()
  // The parachute: the canopy and the lines
  ctx.strokeStyle = `rgba(255,255,255,${0.8 * fade})`
  ctx.lineWidth = 1.2 * s
  ctx.beginPath()
  ctx.arc(cx, cy - 7 * s, 6 * s, Math.PI, 0)
  ctx.moveTo(cx - 6 * s, cy - 7 * s)
  ctx.lineTo(cx, cy)
  ctx.moveTo(cx + 6 * s, cy - 7 * s)
  ctx.lineTo(cx, cy)
  ctx.stroke()
  ctx.fillStyle = `rgba(255,255,255,${fade})`
  ctx.beginPath()
  ctx.arc(cx, cy, 2 * s, 0, Math.PI * 2)
  ctx.fill()
}

function drawSmokeD(ctx: CanvasRenderingContext2D, p: FlightParams, e: number, s: number) {
  // The flash of the squib and growing puffs of smoke that stay
  const flash = clamp01(1 - e / 0.2)
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flash * 0.9})`
    ctx.beginPath()
    ctx.arc(p.bx, p.by, 9 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  const grow = clamp01(e / 2.5)
  const alpha = 0.55 * clamp01(e / 0.4) * (1 - clamp01((e - 3.2) / 0.8) * 0.4)
  for (let i = 0; i < 7; i += 1) {
    const a = rnd(i + 2) * Math.PI * 2
    const d = (6 + rnd(i + 9) * 14) * s * grow
    const r = (6 + rnd(i + 4) * 7) * s * (0.4 + grow)
    const x = p.bx + Math.cos(a) * d
    const y = p.by + Math.sin(a) * d * 0.6 - e * 1.5 * s
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(235,235,235,${alpha})`)
    g.addColorStop(1, 'rgba(200,200,200,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** One frame of the flight and burst animation. */

/** The muzzle flash: a ring (the minimal style) or a warm spot (the detailed one). */
function drawMuzzle(ctx: CanvasRenderingContext2D, p: FlightParams, s: number) {
  const k = clamp01(p.elapsed / 0.35)
  if (k >= 1) return
  if (p.style === 'detailed') {
    const g = ctx.createRadialGradient(p.ax, p.ay, 0, p.ax, p.ay, 14 * s)
    g.addColorStop(0, `rgba(255,226,140,${1 - k})`)
    g.addColorStop(1, 'rgba(255,160,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.ax, p.ay, 14 * s, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ring(ctx, p.ax, p.ay, (3 + k * 12) * s, (1 - k) * 0.9, 1.6 * s, INK)
}

/** One frame of the flight and burst animation. */
export function drawFlight(ctx: CanvasRenderingContext2D, p: FlightParams) {
  const s = p.scale ?? 1
  if (p.elapsed < 0 || p.tof <= 0) return
  if (p.muzzle) drawMuzzle(ctx, p, s)
  const t = p.elapsed / p.tof
  const detailed = p.style === 'detailed'
  if (t < 1) {
    if (detailed) {
      drawTrailD(ctx, p, t, s)
      drawProjectileD(ctx, p, t, s)
    } else {
      drawTrail(ctx, p, t, s)
      drawProjectile(ctx, p, t, s)
    }
    return
  }
  const e = p.elapsed - p.tof
  if (e > IMPACT_FX_SECONDS) return
  switch (p.kind) {
    case 'illum':
      if (detailed) drawIllumD(ctx, p, e, s)
      else drawIllum(ctx, p, e, s)
      break
    case 'smoke':
      if (detailed) drawSmokeD(ctx, p, e, s)
      else drawSmoke(ctx, p, e, s)
      break
    default:
      if (detailed) drawHeD(ctx, p, e, s)
      else drawHe(ctx, p, e, s)
  }
}
