#!/usr/bin/env node
/**
 * Built-in maps from an export of the grad_meh mod (Gruppe Adler Map Exporter).
 *
 *   node scripts/import-grad-meh.mjs "<Arma 3>/grad_meh/stratis" [more folders…]
 *
 * Taken from the map folder:
 *   sat/<column>/<row>.png     - the satellite image (a grid of tiles, north up);
 *   dem.asc.gz                 - heights (ESRI ASCII Grid);
 *   meta.json                  - the name and size of the map.
 * Written to web/public/maps/<map>/:
 *   tiles/<z>/<x>_<y>.webp - a pyramid of 512 px tiles (z = 0 is the whole map in one tile);
 *   heights.bin            - heights, Int16 in decimetres, rows from south to north;
 *   map.json               - the map description for the app.
 * With geojson/ also vector.json (buildings, roads, forests, contour lines, names).
 * And the common list web/public/maps/index.json.
 *
 * The --no-sat flag: a map without a satellite image (an export from tools/arma/gradtopo_export.sqf via
 * scripts/import-rpt.mjs): only heights and vector.json, the app shows it in the Topo mode.
 * The --vector-only flag: rebuild only vector.json of maps that are already imported.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import sharp from 'sharp'
import { buildVector } from './build-vector.mjs'
import { makePreview } from './make-map-previews.mjs'

const TILE = 512
// The top level is no finer than this, m per pixel
const TARGET_METERS_PER_PIXEL = 2
// The height grid step is about this, m (a multiple of the source grid step)
const TARGET_HEIGHT_STEP = 20
const QUALITY = 70

const OUT_ROOT = new URL('../public/maps/', import.meta.url)

function hex(rgba) {
  return `#${rgba
    .slice(0, 3)
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

// ---- satellite image → tile pyramid ----

async function buildTiles(source, outDir, worldSize, background) {
  const columns = readdirSync(join(source, 'sat'))
    .filter((name) => /^\d+$/.test(name))
    .map(Number)
    .sort((a, b) => a - b)
  const n = columns.length
  const sourceMeters = worldSize / n
  // How many output tiles per source tile along a side
  // Huge maps (Beketov, Altis) are coarser: otherwise the tiles weigh tens of MB
  const mpp = Math.max(TARGET_METERS_PER_PIXEL, worldSize / 6144)
  const perSource = Math.ceil(sourceMeters / (TILE * mpp))
  const maxCols = n * perSource
  const levels = Math.ceil(Math.log2(maxCols)) + 1
  const top = levels - 1

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(join(outDir, String(top)), { recursive: true })

  // The top level: every source tile is scaled down once and cut
  for (const a of columns) {
    for (let b = 0; b < n; b += 1) {
      const file = join(source, 'sat', String(a), `${b}.png`)
      const { data, info } = await sharp(file)
        .removeAlpha()
        .resize(perSource * TILE, perSource * TILE)
        .raw()
        .toBuffer({ resolveWithObject: true })
      for (let tx = 0; tx < perSource; tx += 1) {
        for (let ty = 0; ty < perSource; ty += 1) {
          // Sizes only: the premultiplied flag from info spoils the colours
          await sharp(data, {
            raw: { width: info.width, height: info.height, channels: info.channels },
          })
            .extract({ left: tx * TILE, top: ty * TILE, width: TILE, height: TILE })
            .webp({ quality: QUALITY })
            .toFile(join(outDir, String(top), `${a * perSource + tx}_${b * perSource + ty}.webp`))
        }
      }
      process.stdout.write('.')
    }
  }

  // Lower levels: four neighbouring tiles → one
  let cols = maxCols
  for (let z = top - 1; z >= 0; z -= 1) {
    const childCols = cols
    cols = Math.ceil(cols / 2)
    mkdirSync(join(outDir, String(z)), { recursive: true })
    for (let x = 0; x < cols; x += 1) {
      for (let y = 0; y < cols; y += 1) {
        const parts = []
        for (let dx = 0; dx < 2; dx += 1) {
          for (let dy = 0; dy < 2; dy += 1) {
            const cx = x * 2 + dx
            const cy = y * 2 + dy
            if (cx >= childCols || cy >= childCols) continue
            parts.push({
              input: join(outDir, String(z + 1), `${cx}_${cy}.webp`),
              left: dx * TILE,
              top: dy * TILE,
            })
          }
        }
        const merged = await sharp({
          create: { width: TILE * 2, height: TILE * 2, channels: 3, background },
        })
          .composite(parts)
          .png()
          .toBuffer()
        await sharp(merged)
          .resize(TILE, TILE)
          .webp({ quality: QUALITY })
          .toFile(join(outDir, String(z), `${x}_${y}.webp`))
      }
    }
  }
  process.stdout.write('\n')

  return {
    size: TILE,
    levels,
    // Metres per top level tile
    metersPerTile: worldSize / maxCols,
    ext: 'webp',
  }
}

// ---- heights: ESRI ASCII Grid → Int16, decimetres ----

function buildHeights(source, outFile) {
  const text = gunzipSync(readFileSync(join(source, 'dem.asc.gz'))).toString('latin1')
  const lines = text.split('\n')
  const header = {}
  let row0 = 0
  for (; row0 < lines.length; row0 += 1) {
    const match = lines[row0].trim().match(/^([a-zA-Z_]+)\s+(-?[\d.]+)$/)
    if (!match) break
    header[match[1].toLowerCase()] = Number(match[2])
  }
  const { ncols, nrows, cellsize } = header
  const k = Math.max(1, Math.round(TARGET_HEIGHT_STEP / cellsize))
  const step = cellsize * k
  const size = Math.floor((Math.min(ncols, nrows) - 1) / k) + 1
  const heights = new Int16Array(size * size)

  // File row 0 is the north; in the app row 0 is the south
  for (let j = 0; j < size; j += 1) {
    const values = lines[row0 + (nrows - 1 - j * k)].trim().split(/\s+/)
    for (let i = 0; i < size; i += 1) {
      const h = Number(values[i * k])
      heights[j * size + i] = Math.max(-32768, Math.min(32767, Math.round(h * 10)))
    }
  }
  writeFileSync(outFile, Buffer.from(heights.buffer))
  return { file: 'heights.bin', step, size, scale: 0.1 }
}

// ---- one map ----

const noSat = process.argv.includes('--no-sat')

/** A preview of a map without a satellite image: a paper background. */
async function makePaperPreview(file) {
  await sharp({ create: { width: 192, height: 192, channels: 3, background: '#f4f2ea' } })
    .webp({ quality: 70 })
    .toFile(fileURLToPath(file))
}

async function importVectorOnly(source) {
  // Vanilla maps (Altis, Stratis, Tanoa) have no meta.json in the export: the folder name is used
  const metaFile = join(source, 'meta.json')
  const world = existsSync(metaFile)
    ? String(JSON.parse(readFileSync(metaFile, 'utf8')).worldName).toLowerCase()
    : basename(source).toLowerCase()
  const outDir = new URL(`./${world}/`, OUT_ROOT)
  const mapFile = new URL('map.json', outDir)
  if (!existsSync(mapFile)) {
    console.log(`${world}: the map is not imported yet, skipped`)
    return
  }
  const vector = buildVector(source, new URL('vector.json', outDir), fileURLToPath(outDir))
  if (!vector) {
    console.log(`${world}: no geojson/, skipped`)
    return
  }
  const map = JSON.parse(readFileSync(mapFile, 'utf8'))
  map.vector = vector.file
  writeFileSync(mapFile, JSON.stringify(map, null, 2) + '\n')
  console.log(`${world}: vector.json ${Math.round(vector.bytes / 1024)} KB`, JSON.stringify(vector.counts))
}

async function importMap(source) {
  const meta = JSON.parse(readFileSync(join(source, 'meta.json'), 'utf8'))
  const world = String(meta.worldName).toLowerCase()
  const worldSize = Number(meta.worldSize)
  const background = hex(meta.colorOutside ?? [0.3, 0.33, 0.37, 1])
  const outDir = new URL(`./${world}/`, OUT_ROOT)
  mkdirSync(outDir, { recursive: true })

  console.log(`${world}: ${meta.displayName}, ${worldSize} m`)
  const heights = buildHeights(source, new URL('heights.bin', outDir))
  console.log(`  heights: ${heights.size}×${heights.size}, step ${heights.step} m`)
  const tiles = noSat
    ? null
    : await buildTiles(source, fileURLToPath(new URL('tiles', outDir)), worldSize, background)
  if (tiles) console.log(`  tiles: ${tiles.levels} levels, ${tiles.metersPerTile.toFixed(1)} m per top tile`)
  else console.log('  no satellite image (topo only)')

  const vector = buildVector(source, new URL('vector.json', outDir))
  if (vector) console.log(`  vector: ${Math.round(vector.bytes / 1024)} KB`, JSON.stringify(vector.counts))

  const map = {
    format: 'arma-map',
    version: 1,
    world,
    displayName: meta.displayName ?? world,
    author: meta.author ?? '',
    worldSize,
    background,
    heights,
    ...(tiles ? { tiles } : { topoOnly: true }),
    ...(vector ? { vector: vector.file } : {}),
  }
  writeFileSync(new URL('map.json', outDir), JSON.stringify(map, null, 2) + '\n')
  // The preview for map lists
  if (noSat) await makePaperPreview(new URL('preview.webp', outDir))
  else await makePreview(world)
  // Official maps are by Bohemia Interactive, the rest are by the community
  const kind = /bohemia/i.test(map.author) ? 'official' : 'community'
  // Taken from the game without grad_meh (tools/arma): the app shows a "simplified quality" badge
  const quality = meta.source === 'gradtopo' ? 'low' : undefined
  return { world, displayName: map.displayName, author: map.author, kind, ...(quality ? { quality } : {}), worldSize }
}

// ---- the map list ----

const vectorOnly = process.argv.includes('--vector-only')
const sources = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (vectorOnly) {
  for (const source of sources) await importVectorOnly(source)
  process.exit(0)
}
if (sources.length === 0) {
  console.error('usage: node scripts/import-grad-meh.mjs <grad_meh map folder>...')
  process.exit(1)
}

const indexFile = new URL('index.json', OUT_ROOT)
mkdirSync(OUT_ROOT, { recursive: true })
const index = existsSync(indexFile)
  ? JSON.parse(readFileSync(indexFile, 'utf8'))
  : { maps: [] }

for (const source of sources) {
  const entry = await importMap(source)
  // Names in other languages are set in index.json by hand: do not overwrite them
  const previous = index.maps.find((m) => m.world === entry.world)
  if (previous?.names) entry.names = previous.names
  // The map kind (DLC, mod) is marked in index.json by hand: the author does not tell
  // a DLC from the base game, and mod maps may have Bohemia as the author (Chernarus from CUP)
  if (previous?.kind) entry.kind = previous.kind
  // The author is edited by hand too: it matters which mod the map is from (Chernarus: CUP)
  if (previous?.author) entry.author = previous.author
  // Shipping the map inside the Windows app is a manual choice too
  if (previous?.bundled) entry.bundled = previous.bundled
  index.maps = [...index.maps.filter((m) => m.world !== entry.world), entry].sort(
    (a, b) => a.displayName.localeCompare(b.displayName)
  )
}
writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n')
console.log(`maps: ${index.maps.map((m) => m.world).join(', ')}`)
