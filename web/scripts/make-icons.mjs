#!/usr/bin/env node
/**
 * App icons (PWA, favicon, Windows app): a white howitzer
 * silhouette on a dark background.
 *
 *   node scripts/make-icons.mjs
 *
 * The result goes to public/ (icon-192.png, icon-512.png, icon-maskable-512.png,
 * favicon.svg) and to src-tauri/icons/ (PNG and icon.ico).
 */
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const BACKGROUND = '#0a0a0a' // the dark theme background
const INK = '#f5f5f5'

// The silhouette on a 24×24 grid: an angled barrel, a breech with a shield, a wheel, a trail
const GLYPH = `
  <g fill="${INK}" stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">
    <line x1="11.5" y1="12.5" x2="21.2" y2="5.6" stroke-width="2.4"/>
    <line x1="19.2" y1="7" x2="21.7" y2="5.2" stroke-width="3.6"/>
    <path d="M7.4 10.6 L12.6 9.6 L14 15.4 L8.6 16.6 Z" stroke-width="1"/>
    <circle cx="10.6" cy="17.2" r="3" stroke="none"/>
    <line x1="8" y1="14.8" x2="2.2" y2="19.4" stroke-width="1.8"/>
    <line x1="1.8" y1="20.6" x2="7.2" y2="20.6" stroke-width="1.6"/>
  </g>
  <circle cx="10.6" cy="17.2" r="1" fill="${BACKGROUND}"/>`

// The centre of the silhouette on the grid (for fitting with a margin)
const CENTER = [11.9, 12.4]

function svg(scale, radius) {
  const tx = 12 - CENTER[0] * scale
  const ty = 12 - CENTER[1] * scale
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="${radius}" fill="${BACKGROUND}"/><g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale})">${GLYPH}</g></svg>`
}

const png = (size, scale, radius) =>
  sharp(Buffer.from(svg(scale, radius)), { density: (72 * size) / 24 })
    .resize(size, size)
    .png()
    .toBuffer()

// ICO from PNG frames (the Vista+ format: PNG right inside)
function ico(frames) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(frames.length, 4)
  let offset = 6 + 16 * frames.length
  const entries = frames.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e[0] = size === 256 ? 0 : size
    e[1] = size === 256 ? 0 : size
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([head, ...entries, ...frames.map((f) => f.data)])
}

const pub = new URL('../public/', import.meta.url)
const tauri = new URL('../src-tauri/icons/', import.meta.url)

writeFileSync(new URL('favicon.svg', pub), svg(0.8, 3) + '\n')
writeFileSync(new URL('icon-192.png', pub), await png(192, 0.8, 3))
writeFileSync(new URL('icon-512.png', pub), await png(512, 0.8, 3))
// Maskable: the background fills the area, the icon is in the safe zone (the central 80%)
writeFileSync(new URL('icon-maskable-512.png', pub), await png(512, 0.62, 0))

writeFileSync(new URL('32x32.png', tauri), await png(32, 0.8, 3))
writeFileSync(new URL('128x128.png', tauri), await png(128, 0.8, 3))
writeFileSync(new URL('128x128@2x.png', tauri), await png(256, 0.8, 3))
writeFileSync(new URL('icon.png', tauri), await png(512, 0.8, 3))
const frames = []
for (const size of [16, 32, 48, 64, 128, 256]) {
  frames.push({ size, data: await png(size, 0.8, 3) })
}
writeFileSync(new URL('icon.ico', tauri), ico(frames))
console.log('icons written')
