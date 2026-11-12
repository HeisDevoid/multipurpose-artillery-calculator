#!/usr/bin/env node
/**
 * The Windows app build without the built-in maps: the tiles weigh tens of
 * megabytes, and the app takes them from the published site
 * (src/lib/builtinMaps.ts, MAPS_BASE). Maps marked "bundled" in index.json
 * stay inside the app, and dist/maps/index.json then lists only them.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const dir = new URL('../dist/maps/', import.meta.url)
const indexFile = new URL('index.json', dir)
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : { maps: [] }
const bundled = (index.maps ?? []).filter((m) => m.bundled)

if (bundled.length === 0) {
  rmSync(dir, { recursive: true, force: true })
  console.log('dist/maps removed for the desktop bundle')
} else {
  const keep = new Set(bundled.map((m) => m.world))
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !keep.has(entry.name)) rmSync(new URL(`${entry.name}/`, dir), { recursive: true, force: true })
  }
  writeFileSync(indexFile, JSON.stringify({ ...index, maps: bundled }, null, 2) + '\n')
  console.log(`dist/maps: ${bundled.length} bundled maps kept (${[...keep].join(', ')})`)
}
