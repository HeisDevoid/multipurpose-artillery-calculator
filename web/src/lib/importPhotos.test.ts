import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

describe('scripts/import-photos.mjs', () => {
  it('stitches map frames into sat/<column>/<row>.png tiles (north up)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'photos-'))
    const images = join(dir, 'shots')
    mkdirSync(images)
    // A 4096 m world, four frames of 2048 m: north-west red, north-east green, south-west blue, south-east yellow
    const colors = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 255, g: 255, b: 0 },
    ]
    const lines = ['GRADPHOTO|META|t|4096|1024|768|2|2']
    for (let i = 0; i < 4; i += 1) {
      const row = Math.floor(i / 2)
      const col = i % 2
      const name = `gradphoto_t_${row}_${col}.png`
      await sharp({ create: { width: 512, height: 512, channels: 3, background: colors[i] } })
        .png()
        .toFile(join(images, name))
      const x0 = col * 2048
      const y0 = 4096 - row * 2048
      lines.push(`18:00:00 "GRADPHOTO|P|${name}|${x0}|${y0}|${x0 + 2048}|${y0 - 2048}"`)
    }
    lines.push('GRADPHOTO|END')
    const rpt = join(dir, 'test.rpt')
    writeFileSync(rpt, lines.join('\n'))
    const out = join(dir, 'export')
    mkdirSync(out)
    execFileSync('node', ['scripts/import-photos.mjs', rpt, out, '--images', images, '--mpp', '2'])

    // n = 1: one 2048 px tile for the whole world (2 m per pixel)
    const tile = sharp(join(out, 'sat', '0', '0.png'))
    const { data, info } = await tile.raw().toBuffer({ resolveWithObject: true })
    expect(info.width).toBe(2048)
    const px = (x: number, y: number) => [0, 1, 2].map((c) => data[(y * info.width + x) * info.channels + c])
    expect(px(100, 100)).toEqual([255, 0, 0])
    expect(px(1900, 100)).toEqual([0, 255, 0])
    expect(px(100, 1900)).toEqual([0, 0, 255])
    expect(px(1900, 1900)).toEqual([255, 255, 0])
  })
})
