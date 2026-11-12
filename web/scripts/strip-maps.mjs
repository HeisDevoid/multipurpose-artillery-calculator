#!/usr/bin/env node
/**
 * The Windows app build without the built-in maps: the tiles weigh tens of
 * megabytes, and the app takes them from the published site
 * (src/lib/builtinMaps.ts, MAPS_BASE).
 */
import { rmSync } from 'node:fs'

rmSync(new URL('../dist/maps/', import.meta.url), { recursive: true, force: true })
console.log('dist/maps removed for the desktop bundle')
