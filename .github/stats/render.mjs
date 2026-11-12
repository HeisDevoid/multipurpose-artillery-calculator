// Stats picture for the README, in the style of the banner:
//   node render.mjs <out.svg> [history.json]
// Data comes from GitHub releases, no dependencies.
// - Downloads: the Windows installer, by version.
// - Daily use: the app downloads a counter file from the "usage" release once a day per
//   device (web/src/lib/usage.ts). GitHub only keeps running totals, so every run adds
//   today's totals to history.json and the chart shows the difference between days.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const repo = process.env.GITHUB_REPOSITORY ?? 'HeisDevoid/multipurpose-artillery-calculator'
const out = process.argv[2] ?? 'stats.svg'
const historyFile = process.argv[3] ?? null
const USAGE_TAG = 'usage'
const SOURCES = [
  { id: 'web', asset: 'web.txt', label: 'Website' },
  { id: 'desktop', asset: 'desktop.txt', label: 'Windows app' },
]
const DAYS_SHOWN = 30
const DAYS_KEPT = 730
const DAY_MS = 86400000

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

const all = await releases()

const versions = all
  .filter((r) => !r.draft && !r.prerelease && /^v\d/.test(r.tag_name))
  .sort((a, b) => a.published_at.localeCompare(b.published_at))
  .map((r) => ({
    version: r.tag_name.replace(/^v/, '').replace(/\.0$/, ''),
    downloads: r.assets.filter((a) => a.name.endsWith('.exe')).reduce((s, a) => s + a.download_count, 0),
  }))

// ---- daily use ----

/** Running totals of the counters, or null until the "usage" release exists. */
function usageTotals() {
  const release = all.find((r) => r.tag_name === USAGE_TAG)
  if (!release) return null
  const totals = {}
  for (const source of SOURCES) {
    totals[source.id] = release.assets.find((a) => a.name === source.asset)?.download_count ?? 0
  }
  return totals
}

/** history.json: { days: [{ date: 'YYYY-MM-DD', web: total, desktop: total }] }, oldest first. */
function readHistory() {
  if (!historyFile || !existsSync(historyFile)) return []
  const parsed = JSON.parse(readFileSync(historyFile, 'utf8'))
  if (!Array.isArray(parsed?.days)) throw new Error(`${historyFile}: no "days" list`)
  return parsed.days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d?.date)).sort((a, b) => a.date.localeCompare(b.date))
}

const today = new Date().toISOString().slice(0, 10)
const totals = usageTotals()
let history = readHistory()
if (totals) {
  history = [...history.filter((d) => d.date !== today), { date: today, ...totals }].slice(-DAYS_KEPT)
}

/**
 * Uses per day from the running totals: what was added between two readings belongs to the
 * days between them. A reading missed for a few days is spread evenly over the gap.
 */
function dailyUse(days) {
  const perDay = []
  for (let i = 1; i < days.length; i++) {
    const from = Date.parse(days[i - 1].date)
    const gap = Math.max(1, Math.round((Date.parse(days[i].date) - from) / DAY_MS))
    for (let k = 0; k < gap; k++) {
      const entry = { date: new Date(from + k * DAY_MS).toISOString().slice(0, 10) }
      for (const source of SOURCES) {
        const added = Math.max(0, (days[i][source.id] ?? 0) - (days[i - 1][source.id] ?? 0))
        entry[source.id] = added / gap
      }
      perDay.push(entry)
    }
  }
  return perDay.slice(-DAYS_SHOWN)
}

const use = dailyUse(history)

// ---- drawing ----

// The canvas matches the banner: 1270 wide, black, corner radius 12
const W = 1270
const H = 360
const PAD = 44
const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
const INK = '#f2f2f2'
const MUTED = '#8c939c'
const LINE = '#1f2226'
const SERIES = { web: INK, desktop: '#6b7280' }

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fmt = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))
const px = (n) => Math.round(n * 10) / 10

function heading(x0, label, value, caption) {
  return [
    `<text x="${x0}" y="${PAD + 18}" font-size="17" font-weight="600" letter-spacing="1.2" fill="${MUTED}">${esc(label)}</text>`,
    `<text x="${x0}" y="${PAD + 78}" font-size="56" font-weight="700" fill="${INK}">${esc(value)}</text>`,
    `<text x="${x0}" y="${PAD + 108}" font-size="17" fill="${MUTED}">${esc(caption)}</text>`,
  ]
}

const CHART_TOP = PAD + 136
const CHART_BASE = H - PAD - 22

/** Installer downloads: one bar per version, the latest one brighter. */
function downloadsTile(x0, width) {
  const bars = versions
  const total = bars.reduce((s, b) => s + b.downloads, 0)
  const parts = heading(x0, 'DOWNLOADS', fmt(total), 'Windows installer, by version')
  const step = Math.min(56, width / Math.max(bars.length, 1))
  const bw = Math.max(6, Math.min(28, step - 6))
  const max = Math.max(1, ...bars.map((b) => b.downloads))
  parts.push(`<line x1="${x0}" y1="${CHART_BASE}" x2="${x0 + width}" y2="${CHART_BASE}" stroke="${LINE}" stroke-width="1"/>`)
  bars.forEach((b, i) => {
    const h = b.downloads === 0 ? 0 : Math.max(3, ((CHART_BASE - CHART_TOP) * b.downloads) / max)
    const x = px(x0 + i * step + (step - bw) / 2)
    const r = Math.min(4, bw / 2, h)
    const top = px(CHART_BASE - h)
    if (h > 0) {
      parts.push(
        `<path d="M${x} ${CHART_BASE}V${px(top + r)}Q${x} ${top} ${px(x + r)} ${top}H${px(x + bw - r)}Q${px(x + bw)} ${top} ${px(x + bw)} ${px(top + r)}V${CHART_BASE}Z" fill="${INK}" fill-opacity="${i === bars.length - 1 ? 1 : 0.55}"><title>${esc(`v${b.version}: ${b.downloads}`)}</title></path>`
      )
    }
    // Version labels: the first and the last only, so they never overlap
    if (i === 0 || i === bars.length - 1) {
      parts.push(`<text x="${px(x + bw / 2)}" y="${CHART_BASE + 18}" font-size="13" text-anchor="middle" fill="${MUTED}">${esc(b.version)}</text>`)
    }
  })
  return parts.join('\n  ')
}

/** Daily use: a line per source over the last days. */
function useTile(x0, width) {
  const week = use.slice(-7)
  const average = week.length ? week.reduce((s, d) => s + SOURCES.reduce((t, src) => t + d[src.id], 0), 0) / week.length : null
  const since = history[0]?.date
  const caption =
    average === null
      ? since
        ? `counting since ${since}, the chart starts tomorrow`
        : 'counting starts with the next release'
      : 'devices a day, 7-day average'
  const parts = heading(x0, 'DAILY USE', average === null ? '–' : fmt(average), caption)

  // Legend on the right of the heading: what each line is and its latest value
  const last = use[use.length - 1]
  let legendX = x0 + width
  for (const source of [...SOURCES].reverse()) {
    const text = last ? `${source.label} ${fmt(last[source.id])}` : source.label
    const textWidth = text.length * 8.6
    legendX -= textWidth
    parts.push(`<text x="${px(legendX)}" y="${PAD + 18}" font-size="15" fill="${MUTED}">${esc(text)}</text>`)
    legendX -= 16
    parts.push(`<circle cx="${px(legendX + 5)}" cy="${PAD + 13}" r="5" fill="${SERIES[source.id]}"/>`)
    legendX -= 22
  }

  parts.push(`<line x1="${x0}" y1="${CHART_BASE}" x2="${x0 + width}" y2="${CHART_BASE}" stroke="${LINE}" stroke-width="1"/>`)
  if (use.length === 0) return parts.join('\n  ')

  const max = Math.max(1, ...use.flatMap((d) => SOURCES.map((s) => d[s.id])))
  const xAt = (i) => (use.length === 1 ? x0 + width / 2 : x0 + (width * i) / (use.length - 1))
  const yAt = (v) => CHART_BASE - ((CHART_BASE - CHART_TOP) * v) / max
  // A faint line at the top value gives the lines a scale
  parts.push(`<line x1="${x0}" y1="${CHART_TOP}" x2="${x0 + width}" y2="${CHART_TOP}" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 5"/>`)
  parts.push(`<text x="${x0 + width}" y="${CHART_TOP - 7}" font-size="13" text-anchor="end" fill="${MUTED}">${fmt(max)}</text>`)
  // The app line first: the site line is drawn over it
  for (const source of [...SOURCES].reverse()) {
    const color = SERIES[source.id]
    const points = use.map((d, i) => `${px(xAt(i))},${px(yAt(d[source.id]))}`)
    if (points.length > 1) {
      parts.push(`<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><title>${esc(source.label)}</title></polyline>`)
    }
    const end = use.length - 1
    parts.push(`<circle cx="${px(xAt(end))}" cy="${px(yAt(use[end][source.id]))}" r="5" fill="${color}" stroke="#000" stroke-width="2"/>`)
  }
  const day = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  parts.push(`<text x="${x0}" y="${CHART_BASE + 18}" font-size="13" fill="${MUTED}">${esc(day(use[0].date))}</text>`)
  if (use.length > 1) {
    parts.push(`<text x="${x0 + width}" y="${CHART_BASE + 18}" font-size="13" text-anchor="end" fill="${MUTED}">${esc(day(use[use.length - 1].date))}</text>`)
  }
  return parts.join('\n  ')
}

// Downloads take a third of the width, the lines get the rest
const inner = W - PAD * 2
const leftW = Math.round(inner * 0.3)
const rightX = PAD + leftW + PAD * 2
const rightW = W - PAD - rightX
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" role="img" aria-label="Installer downloads by version and daily use of the site and the Windows app">
  <rect width="${W}" height="${H}" rx="12" fill="#000"/>
  ${downloadsTile(PAD, leftW)}
  <line x1="${rightX - PAD}" y1="${PAD}" x2="${rightX - PAD}" y2="${H - PAD}" stroke="${LINE}" stroke-width="1"/>
  ${useTile(rightX, rightW)}
  <text x="${W - PAD}" y="${H - 14}" font-size="12" text-anchor="end" fill="${MUTED}" fill-opacity="0.7">updated ${today}</text>
</svg>
`

mkdirSync(dirname(out) || '.', { recursive: true })
writeFileSync(out, svg)
if (historyFile && totals) {
  mkdirSync(dirname(historyFile) || '.', { recursive: true })
  writeFileSync(historyFile, `${JSON.stringify({ days: history })}\n`)
}
console.log(
  `${out}: downloads ${versions.reduce((s, v) => s + v.downloads, 0)}, ` +
    (totals ? SOURCES.map((s) => `${s.id} ${totals[s.id]}`).join(', ') : 'no usage release yet') +
    `, ${history.length} day(s) of history`
)
