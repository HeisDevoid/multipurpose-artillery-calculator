#!/usr/bin/env node
/**
 * Stitches map photos from the game (tools/arma/gradtopo_photos.sqf) into a "satellite" layer
 * in the grad_meh export format: <export-folder>/sat/<column>/<row>.png.
 *
 *   node scripts/import-photos.mjs <file.rpt> <export-folder> [--images <folder> …] [--mpp 2] [--crop 0]
 *
 * --images: where to look for the gradphoto_*.png screenshots (may be repeated; by default
 *           Documents\Arma 3 and the game folder next to the export). The search is recursive.
 * --mpp:    metres per pixel of the final picture (2 by default).
 * --rect:   the map area on a screenshot: x,y,width,height in pixels or auto (the default):
 *           the map takes a rectangle in the game, the rest is the 3D scene; the area is found
 *           by comparing two frames (only the map changes).
 * --degrid: remove the game grid lines (on by default; --degrid off turns it off).
 * --crop:   also cut this many pixels from every edge of the area (frames).
 *
 * After that the map is built as usual (with satellite tiles):
 *   node scripts/import-grad-meh.mjs "<export-folder>"
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import sharp from 'sharp'

const TILE_PX = 2048

const args = process.argv.slice(2)
const flags = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []))
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))
const [rptFile, outDir] = positional
if (!rptFile || !outDir) {
  console.error('usage: node scripts/import-photos.mjs <file.rpt> <export folder> [--images <dir>] [--mpp 2] [--crop 0]')
  process.exit(1)
}
const mpp = Number(flags('--mpp')[0] ?? 2)
const crop = Number(flags('--crop')[0] ?? 0)
const rectArg = flags('--rect')[0] ?? 'auto'
const degridOn = (flags('--degrid')[0] ?? 'on') !== 'off'
const searchDirs = flags('--images')
if (searchDirs.length === 0) {
  searchDirs.push(join(homedir(), 'Documents', 'Arma 3'), join(dirname(outDir), '..'), dirname(outDir), '.')
}

// ---- RPT: where each frame is ----
let worldSize = 0
const shots = new Map()
let ended = false
const rl = createInterface({ input: createReadStream(rptFile, 'utf8'), crlfDelay: Infinity })
for await (const raw of rl) {
  const at = raw.indexOf('GRADPHOTO|')
  if (at < 0) continue
  const p = raw.slice(at + 10).trim().replace(/"+$/, '').split('|')
  if (p[0] === 'META') {
    worldSize = Number(p[2])
    shots.clear()
    ended = false
  } else if (p[0] === 'P') {
    shots.set(p[1], { x0: Number(p[2]), y0: Number(p[3]), x1: Number(p[4]), y1: Number(p[5]) })
  } else if (p[0] === 'END') {
    ended = true
  }
}
if (!worldSize || shots.size === 0) {
  console.error('The RPT has no GRADPHOTO lines: the gradtopo_photos.sqf script did not run.')
  process.exit(1)
}
if (!ended) console.warn('WARNING: no GRADPHOTO|END, the shooting may have been interrupted and a part of the map will be empty.')

// ---- looking for the screenshot files ----
function findFiles(dir, wanted, found, depth = 0) {
  if (depth > 4 || !existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) findFiles(path, wanted, found, depth + 1)
    else if (wanted.has(entry.name) && !found.has(entry.name)) found.set(entry.name, path)
  }
}
const found = new Map()
for (const dir of searchDirs) findFiles(dir, new Set(shots.keys()), found)
console.log(`frames in the log: ${shots.size}, files found: ${found.size}`)
if (found.size === 0) {
  console.error('No gradphoto_*.png screenshots found. Pass the folder: --images "<folder>".')
  process.exit(1)
}

// ---- removing the game grid ----
// Grid lines are thin dark lines across the whole frame. A column (or a row) whose brightness
// clearly differs from its neighbours along the whole length counts as a line and is replaced
// by interpolation between clean neighbours.
function lineScores(data, width, height, vertical) {
  const along = vertical ? height : width
  const across = vertical ? width : height
  const lum = (x, y) => {
    const i = (y * width + x) * 3
    return data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11
  }
  const scores = new Float32Array(across)
  for (let c = 3; c < across - 3; c += 1) {
    let sum = 0
    for (let t = 0; t < along; t += 1) {
      const at = (k) => (vertical ? lum(k, t) : lum(t, k))
      const side = (at(c - 3) + at(c + 3)) / 2
      sum += side - at(c)
    }
    scores[c] = sum / along
  }
  return scores
}

function degrid(data, width, height) {
  const out = Buffer.from(data)
  for (const vertical of [true, false]) {
    const across = vertical ? width : height
    const along = vertical ? height : width
    const scores = lineScores(data, width, height, vertical)
    const mark = new Uint8Array(across)
    for (let c = 3; c < across - 3; c += 1) if (scores[c] > 3) mark[c] = 1
    // Line edges: the neighbours are weaker but clearly dark
    for (let c = 3; c < across - 3; c += 1) {
      if (!mark[c] && scores[c] > 1.5 && (mark[c - 1] || mark[c + 1])) mark[c] = 2
    }
    let c = 0
    while (c < across) {
      if (!mark[c]) { c += 1; continue }
      let e = c
      while (e + 1 < across && mark[e + 1]) e += 1
      const a = Math.max(0, c - 2)
      const b = Math.min(across - 1, e + 2)
      for (let k = c; k <= e; k += 1) {
        const t = (k - a) / Math.max(1, b - a)
        for (let u = 0; u < along; u += 1) {
          const ia = (vertical ? u * width + a : a * width + u) * 3
          const ib = (vertical ? u * width + b : b * width + u) * 3
          const io = (vertical ? u * width + k : k * width + u) * 3
          for (let ch = 0; ch < 3; ch += 1) out[io + ch] = Math.round(data[ia + ch] * (1 - t) + data[ib + ch] * t)
        }
      }
      c = e + 1
    }
  }
  return out
}

// ---- the map area on a screenshot ----
async function rawPixels(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

async function detectRect(paths) {
  // Two distant frames are compared: the 3D scene around the map is the same, the map differs
  const a = await rawPixels(paths[0])
  const b = await rawPixels(paths[Math.floor(paths.length / 2)])
  let minX = a.width, minY = a.height, maxX = -1, maxY = -1
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const i = (y * a.width + x) * 3
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
      if (d > 60) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width: a.width, height: a.height }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

let rect
if (rectArg === 'auto') {
  rect = await detectRect([...found.values()])
} else {
  const [left, top, width, height] = rectArg.split(',').map(Number)
  rect = { left, top, width, height }
}
const baseRect = rect
rect = { left: rect.left + crop, top: rect.top + crop, width: rect.width - 2 * crop, height: rect.height - 2 * crop }
console.log(`map area on a frame: x=${rect.left} y=${rect.top} ${rect.width}×${rect.height}`)

// ---- the mosaic ----
const n = Math.ceil(worldSize / (TILE_PX * mpp))
const total = n * TILE_PX
// The mosaic covers exactly the map: metres per pixel are slightly below the requested value
const m = worldSize / total
console.log(`mosaic ${total}×${total} px, ${m.toFixed(2)} m/px, ${n}×${n} tiles`)

const layers = []
for (const [name, path] of found) {
  const s = shots.get(name)
  const wm = s.x1 - s.x0
  const hm = s.y0 - s.y1
  if (wm <= 0 || hm <= 0) continue
  // The logged corners refer to the source area; the --crop cut shifts the anchor
  const mx = (wm / baseRect.width) * crop
  const my = (hm / baseRect.height) * crop
  const x0 = s.x0 + mx
  const y0 = s.y0 - my
  const widthPx = Math.max(1, Math.round((wm - 2 * mx) / m))
  const heightPx = Math.max(1, Math.round((hm - 2 * my) / m))
  let left = Math.round(x0 / m)
  let top = Math.round((worldSize - y0) / m)
  let source = sharp(path).extract(rect).removeAlpha()
  if (degridOn) {
    const { data, info } = await source.raw().toBuffer({ resolveWithObject: true })
    source = sharp(degrid(data, info.width, info.height), { raw: { width: info.width, height: info.height, channels: 3 } })
  }
  let buf = await source.resize(widthPx, heightPx, { fit: 'fill' }).png().toBuffer()
  // Cropping to the mosaic borders
  let w = widthPx
  let h = heightPx
  const cl = Math.max(0, -left)
  const ct = Math.max(0, -top)
  const cr = Math.max(0, left + w - total)
  const cb = Math.max(0, top + h - total)
  if (cl || ct || cr || cb) {
    if (w - cl - cr <= 0 || h - ct - cb <= 0) continue
    buf = await sharp(buf).extract({ left: cl, top: ct, width: w - cl - cr, height: h - ct - cb }).png().toBuffer()
    left += cl
    top += ct
    w -= cl + cr
    h -= ct + cb
  }
  layers.push({ input: buf, left, top })
}

const mosaic = await sharp({
  create: { width: total, height: total, channels: 3, background: { r: 128, g: 128, b: 128 } },
})
  .composite(layers)
  .png()
  .toBuffer()

// ---- tiles sat/<column>/<row>.png (north up) ----
rmSync(join(outDir, 'sat'), { recursive: true, force: true })
for (let a = 0; a < n; a += 1) {
  mkdirSync(join(outDir, 'sat', String(a)), { recursive: true })
  for (let b = 0; b < n; b += 1) {
    await sharp(mosaic)
      .extract({ left: a * TILE_PX, top: b * TILE_PX, width: TILE_PX, height: TILE_PX })
      .png()
      .toFile(join(outDir, 'sat', String(a), `${b}.png`))
  }
  process.stdout.write('.')
}
process.stdout.write('\n')
console.log(`Done: ${layers.length} frames → ${join(outDir, 'sat')}\nNext: node scripts/import-grad-meh.mjs "${outDir}"`)
