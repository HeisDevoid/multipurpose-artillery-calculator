import { heightAt, type Heightmap, type MapPoint } from './heightmap'
import {
  clearance,
  clearanceAlong,
  isBlocked,
  isTight,
  sampleProfile,
} from './terrainClearance'

/**
 * Зоны на карте по рельефу.
 *
 *   from: куда можно попасть из точки, где стоит орудие;
 *   to:   откуда можно попасть в точку, где стоит цель.
 *
 * Вокруг центра строятся лучи; на каждом проверяются дальности от минимальной
 * до максимальной: есть ли решение в таблице и не упрётся ли снаряд в рельеф
 * по пути (та же проверка, что для выстрела по цели). Вода в зону не входит:
 * в «from» по ней не стреляют, в «to» на ней не стоят.
 */

export type CoverageStatus = 'ok' | 'tight' | 'blocked'

// Цвета зон (RGB) для карты и легенды: на карте с прозрачностью
export const COVERAGE_RGB = {
  ok: '70,200,120',
  tight: '255,176,32',
  blocked: '228,72,72',
} as const satisfies Record<CoverageStatus, string>

export interface CoverageSegment {
  // Дальности от центра, м
  from: number
  to: number
  status: CoverageStatus
}

export interface CoverageRay {
  // Направление от центра: радианы, 0 — север, по часовой
  angle: number
  segments: CoverageSegment[]
}

export interface Coverage {
  center: MapPoint
  mode: 'from' | 'to'
  // Угловая ширина луча, радианы
  width: number
  rays: CoverageRay[]
}

/** Возвышение в точку на этой дальности и разнице высот (цель минус орудие). */
export type SolveAt = (distance: number, heightDiff: number) => { elevation: number } | null

export interface CoverageInput {
  map: Heightmap
  center: MapPoint
  mode: 'from' | 'to'
  minRange: number
  maxRange: number
  solve: SolveAt
  // Лучей по кругу
  rays?: number
  // Дальностей на луче
  steps?: number
}

// Высота не больше этой — вода, м
const SEA_LEVEL = 0.5

// Лучей по кругу (1°) и дальностей на луче: контур огибает рельеф,
// а не режет его крупными клиньями
const DEFAULT_RAYS = 360
const DEFAULT_STEPS = 120

function worse(a: CoverageStatus, b: CoverageStatus): CoverageStatus {
  const order: CoverageStatus[] = ['ok', 'tight', 'blocked']
  return order.indexOf(a) >= order.indexOf(b) ? a : b
}

export function computeCoverage(input: CoverageInput): Coverage {
  const rays = input.rays ?? DEFAULT_RAYS
  return {
    center: input.center,
    mode: input.mode,
    width: (Math.PI * 2) / rays,
    rays: computeCoverageRays(input, 0, rays),
  }
}

/** Сколько лучей у зоны (для расчёта по частям). */
export const coverageRayCount = (input: CoverageInput) => input.rays ?? DEFAULT_RAYS

/**
 * Лучи с номерами от start до end (не включая): зону можно считать по
 * частям между кадрами, чтобы интерфейс не замирал.
 */
export function computeCoverageRays(
  { map, center, mode, minRange, maxRange, solve, rays = DEFAULT_RAYS, steps = DEFAULT_STEPS }: CoverageInput,
  start: number,
  end: number
): CoverageRay[] {
  const width = (Math.PI * 2) / rays
  const result: CoverageRay[] = []
  if (!(maxRange > minRange) || maxRange <= 0) return result

  // Шаг высот по лучу и шаг проверяемых дальностей (кратный ему)
  const sampleStep = Math.max(10, map.step / 2)
  const wantedStep = Math.max(sampleStep, (maxRange - minRange) / steps)
  const stride = Math.max(1, Math.round(wantedStep / sampleStep))
  const cell = stride * sampleStep

  for (let r = start; r < Math.min(end, rays); r += 1) {
    const angle = r * width
    const dx = Math.sin(angle)
    const dy = Math.cos(angle)

    // Высоты рельефа от центра наружу, пока луч внутри карты
    const samples: number[] = []
    for (let d = 0; d <= maxRange + cell; d += sampleStep) {
      const h = heightAt(map, { x: center.x + dx * d, y: center.y + dy * d })
      if (h === null) break
      samples.push(h)
    }
    const heights = Float64Array.from(samples)

    const segments: CoverageSegment[] = []
    let open: CoverageSegment | null = null
    const firstIndex = Math.max(1, Math.ceil(minRange / sampleStep / stride) * stride)
    for (let k = firstIndex; k < heights.length; k += stride) {
      const distance = k * sampleStep
      if (distance > maxRange + cell / 2) break

      // «from»: орудие в центре, цель на конце луча; «to»: наоборот
      const first = mode === 'from' ? 0 : k
      const last = mode === 'from' ? k : 0
      const own = heights[first]
      const aim = heights[last]

      let status: CoverageStatus | null = null
      // Вода не в зоне: стрелять по ней незачем («from»), стоять в ней нельзя («to»)
      const land = mode === 'from' ? aim > SEA_LEVEL : own > SEA_LEVEL
      const solved = land ? solve(distance, aim - own) : null
      if (solved !== null) {
        const check = clearanceAlong(heights, first, last, distance, solved.elevation)
        status = isBlocked(check) ? 'blocked' : isTight(check) ? 'tight' : 'ok'
      }

      const from = Math.max(minRange, distance - cell / 2)
      const to = Math.min(maxRange, distance + cell / 2)
      if (status === null) {
        open = null
        continue
      }
      if (open && open.status === status && Math.abs(open.to - from) < 1e-6) {
        open.to = to
      } else {
        open = { from, to, status }
        segments.push(open)
      }
    }

    result.push({ angle, segments })
  }

  return result
}

/** Точка на уровне моря (вода): в зоны не входит. */
export function isWater(map: Heightmap, point: MapPoint): boolean {
  const h = heightAt(map, point)
  return h !== null && h <= SEA_LEVEL
}

/**
 * Достаёт ли орудие до одной точки (цель в воде, которой нет в зоне):
 * статус как у зоны, 'out' — нет решения в таблицах, null — не посчитать.
 */
export function pointStatus(
  map: Heightmap,
  gun: MapPoint,
  target: MapPoint,
  solve: SolveAt
): CoverageStatus | 'out' | null {
  const profile = sampleProfile(map, gun, target)
  if (!profile) return null
  const h = profile.heights
  const solved = solve(profile.distance, h[h.length - 1] - h[0])
  if (!solved) return 'out'
  const check = clearance(profile, solved.elevation)
  return isBlocked(check) ? 'blocked' : isTight(check) ? 'tight' : 'ok'
}

/** Худший статус на круге дальностей: для подписи «достаёт ли вообще». */
export function overallStatus(coverage: Coverage): CoverageStatus | null {
  let status: CoverageStatus | null = null
  for (const ray of coverage.rays) {
    for (const segment of ray.segments) {
      status = status === null ? segment.status : worse(status, segment.status)
    }
  }
  return status
}

export interface Suggestion {
  point: MapPoint
  // Расстояние до точки, м, от той, с которой сравнивали
  distance: number
}

/**
 * Ближайшее хорошее место (зелёный отрезок) к точке `near` и по возможности
 * подальше от цели: стоять близко к цели опаснее. Только режим «to».
 * null — хорошего места нет.
 */
export function nearestGoodSpot(coverage: Coverage, near: MapPoint): Suggestion | null {
  if (coverage.mode !== 'to') return null
  let best: Suggestion | null = null
  for (const ray of coverage.rays) {
    for (const segment of ray.segments) {
      if (segment.status !== 'ok') continue
      // Середина отрезка и его дальний край; берётся ближайшее к `near`
      for (const d of [(segment.from + segment.to) / 2]) {
        const point = {
          x: coverage.center.x + Math.sin(ray.angle) * d,
          y: coverage.center.y + Math.cos(ray.angle) * d,
        }
        const distance = Math.hypot(point.x - near.x, point.y - near.y)
        if (best === null || distance < best.distance) best = { point, distance }
      }
    }
  }
  return best
}
