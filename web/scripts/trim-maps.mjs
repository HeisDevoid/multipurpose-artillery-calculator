#!/usr/bin/env node
/**
 * Reduces the weight of the built-in maps: removes the most detailed tile level
 * of maps where it is heavier than the threshold (3 MB by default). The detail
 * halves (about 4 m per pixel), which is enough for aiming.
 *
 *   node scripts/trim-maps.mjs [threshold, MB] [map…]
 *
 * Without map names every map is checked.
 */
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../public/maps/', import.meta.url))
const limitMb = Number(process.argv[2] ?? 3)
const only = new Set(process.argv.slice(3))

function sizeMb(dir) {
  let total = 0
  for (const name of readdirSync(dir)) {
    const stat = statSync(join(dir, name))
    total += stat.isDirectory() ? sizeMb(join(dir, name)) * 1024 * 1024 : stat.size
  }
  return total / 1024 / 1024
}

let saved = 0
for (const world of readdirSync(ROOT)) {
  if (only.size > 0 && !only.has(world)) continue
  const mapFile = join(ROOT, world, 'map.json')
  try {
    statSync(mapFile)
  } catch {
    continue
  }
  const map = JSON.parse(readFileSync(mapFile, 'utf8'))
  // A map without a satellite image has no tiles
  if (!map.tiles) continue
  const top = map.tiles.levels - 1
  const topDir = join(ROOT, world, 'tiles', String(top))
  if (top < 1) continue
  const mb = sizeMb(topDir)
  if (mb <= limitMb) continue
  rmSync(topDir, { recursive: true, force: true })
  map.tiles.levels -= 1
  map.tiles.metersPerTile *= 2
  writeFileSync(mapFile, JSON.stringify(map, null, 2) + '\n')
  saved += mb
  console.log(`${world}: level ${top} (${mb.toFixed(1)} MB) removed`)
}
console.log(`Freed ${saved.toFixed(1)} MB`)
