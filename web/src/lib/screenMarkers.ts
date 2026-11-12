import type { MarkerColor } from './markers'

/**
 * Finding markers on a screenshot of the Arma map.
 *
 * The paper map of the game is pale: forest, fields and water have low
 * saturation. Player markers are drawn in pure colours
 * (ColorRed, ColorBlue…), so saturated spots the size of an icon
 * are searched for. Long roads are cut off by size, the label letters
 * to the right of an icon by the nearby larger spot of the same colour.
 */

export interface Blob {
  // The spot centre, screenshot pixels
  x: number
  y: number
  color: MarkerColor
  area: number
  width: number
  height: number
}

export interface DetectOptions {
  minSize: number
  maxSize: number
  minArea: number
  // The share of filled pixels in the spot frame
  minFill: number
}

export const DEFAULT_DETECT: DetectOptions = {
  minSize: 7,
  maxSize: 48,
  minArea: 20,
  minFill: 0.2,
}

/** The marker colour by a pixel; null: the map background. */
export function classifyPixel(r: number, g: number, b: number): MarkerColor | null {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const value = max / 255
  const saturation = max === 0 ? 0 : (max - min) / max

  // Black markers are not searched for: the grid, labels and contour lines
  // are drawn in black on the map, and they cannot be told from icons.
  if (saturation < 0.6 || value < 0.35) return null

  let hue: number
  const delta = max - min
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue = (hue * 60 + 360) % 360

  if (hue < 18 || hue >= 330) return 'red'
  if (hue < 42) return 'orange'
  if (hue < 70) return 'yellow'
  if (hue < 170) return 'green'
  if (hue >= 200 && hue < 260) return 'blue'
  if (hue >= 270 && hue < 330) return 'purple'
  return null
}

/** Saturated spots the size of a marker icon. */
export function findBlobs(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: DetectOptions = DEFAULT_DETECT
): Blob[] {
  const colors = new Int8Array(width * height).fill(-1)
  const palette: MarkerColor[] = []
  for (let i = 0; i < width * height; i += 1) {
    const color = classifyPixel(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])
    if (!color) continue
    let index = palette.indexOf(color)
    if (index < 0) index = palette.push(color) - 1
    colors[i] = index
  }

  const seen = new Uint8Array(width * height)
  const stack: number[] = []
  const blobs: Blob[] = []

  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || colors[start] < 0) continue
    const color = colors[start]
    let area = 0
    let sumX = 0
    let sumY = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    let tooBig = false

    stack.push(start)
    seen[start] = 1
    while (stack.length > 0) {
      const index = stack.pop()!
      const x = index % width
      const y = (index - x) / width
      area += 1
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (maxX - minX > options.maxSize * 2 || maxY - minY > options.maxSize * 2) {
        tooBig = true
      }

      // 8 neighbours: thin diagonal lines of the icons do not break
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          const next = ny * width + nx
          if (!seen[next] && colors[next] === color) {
            seen[next] = 1
            stack.push(next)
          }
        }
      }
    }

    const w = maxX - minX + 1
    const h = maxY - minY + 1
    if (
      tooBig ||
      w > options.maxSize ||
      h > options.maxSize ||
      Math.max(w, h) < options.minSize ||
      area < options.minArea ||
      area / (w * h) < options.minFill
    ) {
      continue
    }

    blobs.push({
      x: sumX / area,
      y: sumY / area,
      color: palette[color],
      area,
      width: w,
      height: h,
    })
  }

  return dropLabels(mergeNearby(blobs))
}

/** Parts of one icon (a cross, a frame) become one spot. */
function mergeNearby(blobs: Blob[]): Blob[] {
  const result: Blob[] = []
  for (const blob of [...blobs].sort((a, b) => b.area - a.area)) {
    const host = result.find(
      (other) =>
        other.color === blob.color &&
        Math.hypot(other.x - blob.x, other.y - blob.y) <
          Math.max(other.width, other.height) * 0.6
    )
    if (host) {
      const area = host.area + blob.area
      host.x = (host.x * host.area + blob.x * blob.area) / area
      host.y = (host.y * host.area + blob.y * blob.area) / area
      host.area = area
    } else {
      result.push({ ...blob })
    }
  }
  return result
}

/** Label letters to the right of an icon of the same colour are not markers. */
function dropLabels(blobs: Blob[]): Blob[] {
  const sorted = [...blobs].sort((a, b) => b.area - a.area)
  const kept: Blob[] = []
  for (const blob of sorted) {
    const isLabel = kept.some(
      (icon) =>
        icon.color === blob.color &&
        blob.x > icon.x &&
        blob.x - icon.x < 260 &&
        Math.abs(blob.y - icon.y) < icon.height * 0.75 &&
        blob.area < icon.area
    )
    if (!isLabel) kept.push(blob)
  }
  return kept
}

// ---- calibration: screenshot pixels → map metres ----

export interface CalibrationPoint {
  // A pixel on the screenshot
  px: number
  py: number
  // Map metres (from the grid coordinate)
  x: number
  y: number
}

export interface Calibration {
  // Metres per pixel
  scale: number
  // Pixel (0, 0) in metres
  originX: number
  originY: number
}

/**
 * Two points with known coordinates. The Arma map is not rotated:
 * north is up, the scale is the same on both axes.
 */
export function calibrate(
  a: CalibrationPoint,
  b: CalibrationPoint
): Calibration | null {
  const pixels = Math.hypot(b.px - a.px, b.py - a.py)
  const metres = Math.hypot(b.x - a.x, b.y - a.y)
  if (pixels < 20 || metres <= 0) return null
  const scale = metres / pixels
  return {
    scale,
    originX: a.x - a.px * scale,
    originY: a.y + a.py * scale,
  }
}

export function pixelToMap(c: Calibration, px: number, py: number) {
  return { x: c.originX + px * c.scale, y: c.originY - py * c.scale }
}

/** The map area visible on the screenshot, m. */
export function visibleArea(c: Calibration, width: number, height: number) {
  return {
    minX: c.originX,
    maxX: c.originX + width * c.scale,
    minY: c.originY - height * c.scale,
    maxY: c.originY,
  }
}
