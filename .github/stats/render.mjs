// Картинка со статистикой для README в стиле баннера: node render.mjs <out.svg>
// Данные из релизов GitHub: скачивания установщика по версиям и проверки
// обновлений (установленная программа запрашивает latest.json). Без зависимостей.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const repo = process.env.GITHUB_REPOSITORY ?? 'HeisDevoid/multipurpose-artillery-calculator'
const out = process.argv[2] ?? 'stats.svg'

async function releases() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'artillery-calculator-stats' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const all = []
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, { headers })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const batch = await res.json()
    all.push(...batch)
    if (batch.length < 100) return all
  }
}

const list = (await releases())
  .filter((r) => !r.draft && !r.prerelease)
  .sort((a, b) => a.published_at.localeCompare(b.published_at))
  .map((r) => ({
    version: r.tag_name.replace(/^v/, '').replace(/\.0$/, ''),
    downloads: r.assets.filter((a) => a.name.endsWith('.exe')).reduce((s, a) => s + a.download_count, 0),
    checks: r.assets.filter((a) => a.name === 'latest.json').reduce((s, a) => s + a.download_count, 0),
    hasUpdater: r.assets.some((a) => a.name === 'latest.json'),
  }))

const tiles = [
  {
    label: 'DOWNLOADS',
    caption: 'Windows installer, by version',
    bars: list.map((r) => ({ x: r.version, y: r.downloads })),
  },
  {
    label: 'APP USE',
    caption: 'update checks by installed apps',
    bars: list.filter((r) => r.hasUpdater).map((r) => ({ x: r.version, y: r.checks })),
  },
]

// Холст как у баннера: 1270×300, чёрный, скругление 12
const W = 1270
const H = 300
const PAD = 44
const GAP = 1
const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
const INK = '#f2f2f2'
const MUTED = '#8c939c'
const LINE = '#1f2226'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

function tile(t, x0, width) {
  const total = t.bars.reduce((s, b) => s + b.y, 0)
  const parts = [
    `<text x="${x0}" y="${PAD + 18}" font-size="17" font-weight="600" letter-spacing="1.2" fill="${MUTED}">${esc(t.label)}</text>`,
    `<text x="${x0}" y="${PAD + 78}" font-size="56" font-weight="700" fill="${INK}">${fmt(total)}</text>`,
    `<text x="${x0}" y="${PAD + 108}" font-size="17" fill="${MUTED}">${esc(t.caption)}</text>`,
  ]
  // Столбики по версиям: тонкие, с отступом 2 px, скругление 4 px только сверху
  const top = PAD + 136
  const base = H - PAD - 22
  const n = Math.max(t.bars.length, 1)
  const step = Math.min(56, width / n)
  const bw = Math.max(6, Math.min(28, step - 6))
  const max = Math.max(1, ...t.bars.map((b) => b.y))
  parts.push(`<line x1="${x0}" y1="${base}" x2="${x0 + width}" y2="${base}" stroke="${LINE}" stroke-width="1"/>`)
  t.bars.forEach((b, i) => {
    const h = b.y === 0 ? 0 : Math.max(3, ((base - top) * b.y) / max)
    const x = x0 + i * step + (step - bw) / 2
    const r = Math.min(4, bw / 2, h)
    if (h > 0) {
      parts.push(
        `<path d="M${x} ${base}V${base - h + r}Q${x} ${base - h} ${x + r} ${base - h}H${x + bw - r}Q${x + bw} ${base - h} ${x + bw} ${base - h + r}V${base}Z" fill="${INK}" fill-opacity="${i === t.bars.length - 1 ? 1 : 0.55}"><title>${esc(`v${b.x}: ${b.y}`)}</title></path>`
      )
    }
    // Подписи версий: первая и последняя, чтобы не налезали
    if (i === 0 || i === t.bars.length - 1) {
      parts.push(`<text x="${x + bw / 2}" y="${base + 18}" font-size="13" text-anchor="middle" fill="${MUTED}">${esc(b.x)}</text>`)
    }
  })
  return parts.join('\n  ')
}

const inner = W - PAD * 2
const tileW = (inner - (tiles.length - 1) * PAD * 2) / tiles.length
const body = tiles
  .map((t, i) => {
    const x0 = PAD + i * (tileW + PAD * 2)
    const divider = i > 0 ? `<line x1="${x0 - PAD}" y1="${PAD}" x2="${x0 - PAD}" y2="${H - PAD}" stroke="${LINE}" stroke-width="${GAP}"/>` : ''
    return `${divider}\n  ${tile(t, x0, tileW)}`
  })
  .join('\n  ')

const updated = new Date().toISOString().slice(0, 10)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="Downloads and app use by version">
  <rect width="${W}" height="${H}" rx="12" fill="#000"/>
  ${body}
  <text x="${W - PAD}" y="${H - 16}" font-size="12" text-anchor="end" fill="${MUTED}" fill-opacity="0.7">updated ${updated}</text>
</svg>
`

mkdirSync(dirname(out) || '.', { recursive: true })
writeFileSync(out, svg)
console.log(`${out}: ${tiles.map((t) => `${t.label} ${t.bars.reduce((s, b) => s + b.y, 0)}`).join(', ')}`)
