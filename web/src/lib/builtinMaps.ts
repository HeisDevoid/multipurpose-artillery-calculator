import { isDesktop } from './desktop'
import type { Heightmap } from './heightmap'
import { PUBLIC_SITE_URL } from './sync'

/**
 * Built-in maps: a tiled satellite image and heights, built by
 * scripts/import-grad-meh.mjs from an export of the grad_meh mod.
 * They live in public/maps/ and open without an import: on the site, a phone
 * and in the Windows app (it takes them from the site, so as not to bloat
 * the installer). Maps marked "bundled" in index.json ship inside the Windows
 * app instead (scripts/strip-maps.mjs keeps them), and it lists them next to
 * the site maps.
 */

const LOCAL_MAPS = './maps/'
export const MAPS_BASE = isDesktop ? `${PUBLIC_SITE_URL}maps/` : LOCAL_MAPS

// The folder of every listed map: the site or the copy inside the app
const folderOf = new Map<string, string>()

/** The folder of a map, ending with "/". */
export function mapFolder(world: string): string {
  return folderOf.get(world) ?? `${MAPS_BASE}${world}/`
}

export interface BuiltinMapEntry {
  world: string
  displayName: string
  // Names in other languages (the key is the language code) if they differ from displayName
  names?: Partial<Record<string, string>>
  author: string
  // official: the base game, dlc: Bohemia expansions and Creator DLC, community: community maps
  kind?: MapKind
  // low: the map was taken from the game without grad_meh: coarser heights, the background is a picture of the game map
  quality?: 'low'
  worldSize: number
  // Ships inside the Windows app instead of being loaded from the site
  bundled?: boolean
}

export type MapKind = 'official' | 'dlc' | 'community'

/** The origin of the map; old index.json entries have no kind, so the author decides. */
export function mapKind(entry: Pick<BuiltinMapEntry, 'kind' | 'author'>): MapKind {
  if (entry.kind) return entry.kind
  return /bohemia/i.test(entry.author) ? 'official' : 'community'
}

export interface MapTiles {
  // The tile folder address, ending with "/"
  base: string
  size: number
  // Pyramid levels; 0 is the whole map in one tile
  levels: number
  // Metres per tile of the top (most detailed) level
  metersPerTile: number
  ext: string
  background: string
  worldSize: number
}

export interface MapDescription {
  world: string
  displayName: string
  author: string
  worldSize: number
  background: string
  heights: { file: string; step: number; size: number; scale: number }
  // vector.json: buildings, roads, contour lines (not every map has it)
  vector?: string
  // Missing for maps without a satellite image (topo only)
  tiles: { size: number; levels: number; metersPerTile: number; ext: string } | null
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isString = (value: unknown): value is string => typeof value === 'string'

/** map.json validation; null: not our format or damaged. */
export function parseMapDescription(value: unknown): MapDescription | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const h = v.heights as Record<string, unknown> | undefined
  const t = v.tiles as Record<string, unknown> | undefined
  if (
    v.format !== 'arma-map' ||
    v.version !== 1 ||
    !isString(v.world) ||
    !/^[a-z0-9_-]+$/.test(v.world) ||
    !isNumber(v.worldSize) ||
    typeof h !== 'object' ||
    h === null ||
    !isString(h.file) ||
    !/^[\w.-]+$/.test(h.file) ||
    !isNumber(h.step) ||
    !isNumber(h.size) ||
    !isNumber(h.scale) ||
    (v.topoOnly !== true &&
      (typeof t !== 'object' ||
        t === null ||
        !isNumber(t.size) ||
        !isNumber(t.levels) ||
        !isNumber(t.metersPerTile) ||
        !isString(t.ext) ||
        !/^\w+$/.test(t.ext)))
  ) {
    return null
  }
  return {
    world: v.world,
    displayName: isString(v.displayName) ? v.displayName : v.world,
    author: isString(v.author) ? v.author : '',
    worldSize: v.worldSize,
    background: isString(v.background) ? v.background : '#4b555f',
    vector: isString(v.vector) && /^[\w.-]+$/.test(v.vector) ? v.vector : undefined,
    heights: {
      file: h.file,
      step: h.step,
      size: Math.round(h.size),
      scale: h.scale,
    },
    tiles:
      v.topoOnly === true || !t
        ? null
        : {
            size: Math.round(t.size as number),
            levels: Math.round(t.levels as number),
            metersPerTile: t.metersPerTile as number,
            ext: t.ext as string,
          },
  }
}

/** Heights from heights.bin: Int16, rows from south to north. */
export function decodeHeights(
  buffer: ArrayBuffer,
  description: MapDescription
): Heightmap | null {
  const { size, step, scale } = description.heights
  if (buffer.byteLength !== size * size * 2) return null
  const raw = new Int16Array(buffer)
  const heights = new Float32Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) heights[i] = raw[i] * scale
  return {
    world: description.world,
    worldSize: description.worldSize,
    step,
    size,
    heights,
  }
}

async function readIndex(base: string): Promise<BuiltinMapEntry[]> {
  try {
    const response = await fetch(`${base}index.json`)
    if (!response.ok) return []
    const data = (await response.json()) as { maps?: unknown }
    if (!Array.isArray(data.maps)) return []
    return data.maps.filter(
      (m): m is BuiltinMapEntry =>
        typeof m === 'object' &&
        m !== null &&
        isString((m as BuiltinMapEntry).world) &&
        isString((m as BuiltinMapEntry).displayName) &&
        isNumber((m as BuiltinMapEntry).worldSize)
    )
  } catch {
    // No network and no cache: no built-in maps
    return []
  }
}

/** Map lists from several places: a later place wins, and every map gets its folder. */
export function mergeMapLists(lists: { base: string; maps: BuiltinMapEntry[] }[]): {
  maps: BuiltinMapEntry[]
  folders: Map<string, string>
} {
  const byWorld = new Map<string, BuiltinMapEntry>()
  const folders = new Map<string, string>()
  for (const { base, maps } of lists) {
    for (const entry of maps) {
      byWorld.set(entry.world, entry)
      folders.set(entry.world, `${base}${entry.world}/`)
    }
  }
  return { maps: [...byWorld.values()], folders }
}

export async function listBuiltinMaps(): Promise<BuiltinMapEntry[]> {
  // The Windows app: the site maps plus the ones shipped inside the app (they win)
  const bases = MAPS_BASE === LOCAL_MAPS ? [MAPS_BASE] : [MAPS_BASE, LOCAL_MAPS]
  const lists = await Promise.all(bases.map(async (base) => ({ base, maps: await readIndex(base) })))
  const { maps, folders } = mergeMapLists(lists)
  for (const [world, folder] of folders) folderOf.set(world, folder)
  return maps
}

export async function loadBuiltinMap(
  world: string
): Promise<{
  heightmap: Heightmap
  tiles: MapTiles | null
  displayName: string
  vectorUrl: string | null
} | null> {
  const base = mapFolder(world)
  const description = parseMapDescription(
    await (await fetch(`${base}map.json`)).json()
  )
  if (!description) return null
  const buffer = await (await fetch(`${base}${description.heights.file}`)).arrayBuffer()
  const heightmap = decodeHeights(buffer, description)
  if (!heightmap) return null
  return {
    heightmap,
    displayName: description.displayName,
    vectorUrl: description.vector ? `${base}${description.vector}` : null,
    tiles: description.tiles
      ? {
          ...description.tiles,
          base: `${base}tiles/`,
          background: description.background,
          worldSize: description.worldSize,
        }
      : null,
  }
}

/** Metres per tile of level z. */
export function metersPerTile(tiles: MapTiles, z: number): number {
  return tiles.metersPerTile * 2 ** (tiles.levels - 1 - z)
}

/**
 * The pyramid level for a scale: the coarsest one whose tile pixels
 * per metre are not fewer than the screen pixels per metre.
 */
export function tileLevel(tiles: MapTiles, screenPixelsPerMeter: number): number {
  for (let z = 0; z < tiles.levels; z += 1) {
    if (tiles.size / metersPerTile(tiles, z) >= screenPixelsPerMeter) return z
  }
  return tiles.levels - 1
}

export interface VisibleTile {
  url: string
  // The top left corner of a tile in map metres (y is north)
  x: number
  y: number
  meters: number
}

/** Tiles of level z that fall into the area [minX, maxX] × [minY, maxY], m. */
export function visibleTiles(
  tiles: MapTiles,
  z: number,
  area: { minX: number; maxX: number; minY: number; maxY: number }
): VisibleTile[] {
  const meters = metersPerTile(tiles, z)
  const cols = Math.ceil(tiles.worldSize / meters)
  const top = tiles.worldSize
  const x0 = Math.max(0, Math.floor(area.minX / meters))
  const x1 = Math.min(cols - 1, Math.floor(area.maxX / meters))
  // Row 0 is the north: the tile y is counted from the top edge of the map
  const y0 = Math.max(0, Math.floor((top - area.maxY) / meters))
  const y1 = Math.min(cols - 1, Math.floor((top - area.minY) / meters))
  const result: VisibleTile[] = []
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      result.push({
        url: `${tiles.base}${z}/${x}_${y}.${tiles.ext}`,
        x: x * meters,
        y: top - y * meters,
        meters,
      })
    }
  }
  return result
}
