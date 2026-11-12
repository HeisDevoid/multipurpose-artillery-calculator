import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { mapKind, parseMapDescription } from './builtinMaps'

const ROOT = fileURLToPath(new URL('../../public/maps/', import.meta.url))

// The maps live in the maps branch (npm run maps:pull); without them the map checks are skipped, CI always has them
const HAS_MAPS = existsSync(join(ROOT, 'index.json'))

const index = (HAS_MAPS ? JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')) : { maps: [] }) as {
  maps: { world: string; displayName: string; author: string; kind?: 'official' | 'community'; worldSize: number }[]
}

describe('mapKind', () => {
  it('Bohemia is official, the rest are community', () => {
    expect(mapKind({ author: 'Bohemia Interactive' })).toBe('official')
    expect(mapKind({ author: 'Jacko' })).toBe('community')
  })

  it('an explicit kind wins over the author', () => {
    expect(mapKind({ author: 'Jacko', kind: 'official' })).toBe('official')
  })
})

describe.skipIf(!HAS_MAPS)('built-in maps in public/maps', () => {
  it('the list has maps and no duplicates', () => {
    expect(index.maps.length).toBeGreaterThan(0)
    const worlds = index.maps.map((m) => m.world)
    expect(new Set(worlds).size).toBe(worlds.length)
  })

  it.each(index.maps.map((m) => [m.world, m] as const))(
    '%s: the description, the heights and the tiles agree',
    (world, entry) => {
      const dir = join(ROOT, world)
      const description = parseMapDescription(
        JSON.parse(readFileSync(join(dir, 'map.json'), 'utf8'))
      )
      expect(description).not.toBeNull()
      const d = description!
      expect(d.world).toBe(world)
      expect(d.worldSize).toBe(entry.worldSize)
      expect(['official', 'dlc', 'community']).toContain(entry.kind ?? mapKind(entry))

      // Heights: Int16 for every grid point
      const heights = statSync(join(dir, d.heights.file))
      expect(heights.size).toBe(d.heights.size * d.heights.size * 2)

      const tl = d.tiles
      if (tl) {
        // Every pyramid level has a folder with tiles (in trimmed
        // maps the top level is removed, and levels is reduced with it)
        for (let z = 0; z < tl.levels; z += 1) {
          const level = join(dir, 'tiles', String(z))
          expect(existsSync(level), `level ${z}`).toBe(true)
          expect(readdirSync(level).length).toBeGreaterThan(0)
        }
        expect(existsSync(join(dir, 'tiles', String(tl.levels))), 'an extra level').toBe(false)
  
        expect(existsSync(join(dir, 'tiles', '0', `0_0.${tl.ext}`))).toBe(true)
  
        // The tile grid size covers the whole map
        const top = tl.metersPerTile
        const cols = Math.ceil(d.worldSize / top)
        expect(existsSync(join(dir, 'tiles', String(tl.levels - 1), `${cols - 1}_${cols - 1}.${tl.ext}`))).toBe(true)
      }
      // The map preview for lists
      expect(existsSync(join(dir, "preview.webp"))).toBe(true)
    }
  )

  it('the maps do not bloat: no more than 5 MB per map on average, with the vector layers', () => {
    function size(dir: string): number {
      return readdirSync(dir).reduce((sum, name) => {
        const p = join(dir, name)
        const s = statSync(p)
        return sum + (s.isDirectory() ? size(p) : s.size)
      }, 0)
    }
    expect(size(ROOT) / 1024 / 1024 / index.maps.length).toBeLessThan(5)
  })
})
