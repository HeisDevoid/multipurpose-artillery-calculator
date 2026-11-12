import type { ReactNode } from 'react'

/**
 * The animation for the question "is there air resistance on the server": how to
 * open the ACE range table in the game (Ctrl+Win → the item with the weapon name →
 * the table). Two variants side by side: the item without and with an asterisk, and what
 * the table then holds. The labels are as in the game, in English.
 */

const LOOP = '8s'
const FONT = 'Inter, system-ui, sans-serif'
const MONO = 'ui-monospace, Consolas, monospace'
const STAR = '#ffb020'

// Visible on the [from, to] part of the cycle (fading in and out)
function Phase({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  return (
    <g opacity="0">
      <animate
        attributeName="opacity"
        dur={LOOP}
        repeatCount="indefinite"
        keyTimes={`0;${from};${from + 0.03};${to - 0.03};${to};1`}
        values="0;0;1;1;0;0"
      />
      {children}
    </g>
  )
}

// The game landscape: sky, hills, a dirt road
function Scene({ id }: { id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb0dc" />
          <stop offset="1" stopColor="#cfe0ec" />
        </linearGradient>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a9946e" />
          <stop offset="1" stopColor="#cdbfa4" />
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${id}-sky)`} />
      <path d="M0 58 Q 40 48 90 55 T 170 52 T 200 56 V 70 H0z" fill="#8c9a7c" />
      <rect y="64" width="200" height="86" fill={`url(#${id}-ground)`} />
      <path d="M92 64 L 108 64 L 170 150 L 30 150z" fill="#d9ccb2" opacity=".55" />
      <circle cx="18" cy="66" r="10" fill="#4f6138" />
      <circle cx="32" cy="69" r="7" fill="#5b6e41" />
      <circle cx="186" cy="64" r="8" fill="#4f6138" />
    </>
  )
}

type Icon = 'dot' | 'table' | 'self' | 'plus'

// An ACE menu item: an icon and a label under it (white, with a shadow, as in the game)
function MenuItem({ x, y, label, icon = 'dot' }: { x: number; y: number; label: string; icon?: Icon }) {
  return (
    <g fontFamily={FONT} textAnchor="middle">
      {icon === 'dot' && <circle cx={x} cy={y} r="1.8" fill="#fff" />}
      {icon === 'plus' && <path d={`M${x - 3} ${y}h6M${x} ${y - 3}v6`} stroke="#fff" strokeWidth="1.6" />}
      {icon === 'self' && <path d={`M${x - 4} ${y + 2}l4-4 4 4M${x - 3} ${y + 3}h6`} stroke="#fff" strokeWidth="1.2" fill="none" />}
      <text x={x} y={y + 9.5} fontSize="7.5" fill="#fff" fontWeight="500">
        {label}
      </text>
    </g>
  )
}

// Rows of the Sholef table, HIGH, charge 0 (data-sources/sholef): without
// air resistance and with it (wind, temperature, air density)
const NO_AIR = [
  ['850', '1417', '30.9'],
  ['900', '1406', '30.8'],
  ['950', '1394', '30.7'],
  ['1000', '1383', '30.7'],
  ['1050', '1371', '30.6'],
  ['1100', '1359', '30.5'],
  ['1150', '1347', '30.4'],
  ['1200', '1335', '30.3'],
  ['1250', '1323', '30.2'],
].map((row) => [...row, '-', '-', '-'])

const AIR = [
  ['850', '1395', '29.7', '2.6', '0.2', '-0.9'],
  ['900', '1382', '29.6', '2.7', '0.1', '-0.9'],
  ['950', '1369', '29.5', '2.7', '0.2', '-1.0'],
  ['1000', '1356', '29.4', '2.6', '0.1', '-1.0'],
  ['1050', '1342', '29.4', '2.8', '0.2', '-1.0'],
  ['1100', '1329', '29.2', '2.8', '0.1', '-1.2'],
  ['1150', '1315', '29.1', '2.9', '0.3', '-1.1'],
  ['1200', '1301', '29.0', '2.9', '0.3', '-1.1'],
  ['1250', '1286', '28.9', '2.9', '0.1', '-1.3'],
]

const COL = 25.3
const colX = (i: number) => 40 + COL / 2 + i * COL

// The ACE range table sheet: HIGH/LOW and charges on the left, a white table on the right
function RangeSheet({ withAir }: { withAir: boolean }) {
  const rows = withAir ? AIR : NO_AIR
  return (
    <g transform="translate(4 4)">
      <rect width="40" height="142" fill="#0d0d0d" />
      <rect x="2" y="2" width="17" height="9" fill="#262626" />
      <text x="10.5" y="8.3" fontSize="5" fill="#fff" textAnchor="middle" fontFamily={FONT}>HIGH</text>
      <text x="29" y="8.3" fontSize="5" fill="#777" textAnchor="middle" fontFamily={FONT}>LOW</text>
      {[0, 1, 2, 3, 4].map((n) => (
        <g key={n}>
          {n === 0 && <rect x="2" y="14.5" width="36" height="7.5" fill="#eee" />}
          <text x="4" y={20.2 + n * 9} fontSize="5" fill={n === 0 ? '#111' : '#ddd'} fontFamily={FONT}>[Charge {n}]</text>
        </g>
      ))}
      <rect x="40" width="152" height="142" fill="#fbfbf8" />
      {['RANGE', 'ELEV', 'TIME', 'WIND', 'TEMP', 'DENS'].map((h, i) => (
        <text key={h} x={colX(i)} y="9.5" fontSize="5.2" fill="#222" textAnchor="middle" fontFamily={FONT} fontWeight="700">{h}</text>
      ))}
      <path d="M40 13.5H192" stroke="#999" strokeWidth=".4" />
      {rows.map((row, r) => (
        <g key={r}>
          {row.map((v, i) => {
            const weather = i >= 3
            return (
              <text
                key={i}
                x={colX(i)}
                y={24 + r * 13}
                fontSize="6.2"
                textAnchor="middle"
                fontFamily={MONO}
                fill={weather ? (withAir ? '#0a7a2f' : '#9a9a9a') : '#222'}
                fontWeight={weather && withAir ? 700 : 400}
              >
                {v}
              </text>
            )
          })}
        </g>
      ))}
      {/* The weather columns: this is where the difference shows */}
      <Phase from={0.68} to={0.98}>
        <rect x={40 + 3 * COL + 1} y="2" width={3 * COL - 2.5} height="138" rx="3" fill="none" stroke={STAR} strokeWidth="1.6">
          <animate attributeName="stroke-opacity" values="1;.35;1" dur="1.2s" repeatCount="indefinite" />
        </rect>
      </Phase>
    </g>
  )
}

/**
 * How to open the ACE range table in the game: Ctrl+Win → the item with the weapon
 * name ("Sholef" or "Sholef*") → the table. withAir is the variant with an asterisk
 * (air resistance is on) and filled weather columns.
 */
export function AceMenuDemo({ withAir }: { withAir: boolean }) {
  const id = withAir ? 'ace-air' : 'ace-noair'
  return (
    <svg viewBox="0 0 200 150" className="block w-full" aria-hidden="true">
      <Scene id={id} />
      <g style={{ filter: 'drop-shadow(0 0 1.2px rgba(0,0,0,.75))' }}>
        {/* The ACE self-interaction menu keys (the defaults) */}
        <Phase from={0} to={0.22}>
          <g fontFamily={FONT} fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#fff">
            <rect x="61" y="7" width="34" height="15" rx="3" fill="#111" stroke="#fff" strokeOpacity=".5" />
            <text x="78" y="17.6">Ctrl</text>
            <text x="100" y="17.6">+</text>
            <rect x="105" y="7" width="34" height="15" rx="3" fill="#111" stroke="#fff" strokeOpacity=".5" />
            <text x="122" y="17.6">Win</text>
          </g>
        </Phase>
        {/* The ACE self-interaction menu */}
        <Phase from={0.08} to={0.6}>
          <MenuItem x={100} y={40} label="Medical" icon="plus" />
          <MenuItem x={46} y={58} label="Accessories" />
          <MenuItem x={156} y={60} label="Gestures" />
          <MenuItem x={100} y={78} label="Self Actions" icon="self" />
          <MenuItem x={48} y={96} label="Equipment" />
          <MenuItem x={156} y={96} label="Team Management" />
          <MenuItem x={58} y={124} label="Open Kestrel 4500" />
          {/* Hovering over the item with the weapon name */}
          <Phase from={0.34} to={0.6}>
            <rect x="111" y="112" width="60" height="30" rx="5" fill="#fff" fillOpacity=".2" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
          </Phase>
          {/* The item with the weapon name: the table icon, the label, the asterisk */}
          <g fontFamily={FONT}>
            <rect x="131" y="118" width="10" height="8" rx="1" fill="#fff" stroke="#c84040" strokeWidth=".8" />
            <path d="M131 120.5h10M134.5 118v8M137.8 118v8" stroke="#c84040" strokeWidth=".5" />
            <text x="136" y="136" fontSize="9.5" fill="#fff" fontWeight="700" textAnchor="middle">Sholef</text>
            {withAir && (
              <g>
                <circle cx="158" cy="131.5" r="6" fill="none" stroke={STAR} strokeWidth="1.3">
                  <animate attributeName="r" values="5;8.5;5" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="1;.3;1" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <text x="154" y="139" fontSize="13" fill={STAR} fontWeight="800">*</text>
              </g>
            )}
          </g>
        </Phase>
        {/* The cursor: to the weapon item and a click */}
        <Phase from={0.08} to={0.6}>
          <circle cx="140" cy="117" fill="none" stroke="#fff" strokeWidth="1">
            <animate attributeName="r" dur={LOOP} repeatCount="indefinite" keyTimes="0;0.48;0.56;1" values="0;0;11;11" />
            <animate attributeName="opacity" dur={LOOP} repeatCount="indefinite" keyTimes="0;0.48;0.56;1" values="0;1;0;0" />
          </circle>
          <path d="M0 0 L0 9 L2.5 6.8 L4.5 11 L6 10.3 L4 6.2 L7.5 6.2 Z" fill="#fff" stroke="#333" strokeWidth=".4">
            <animateTransform
              attributeName="transform"
              type="translate"
              dur={LOOP}
              repeatCount="indefinite"
              keyTimes="0;0.16;0.34;1"
              values="100 84;100 84;140 117;140 117"
            />
          </path>
        </Phase>
      </g>
      {/* The range table */}
      <Phase from={0.58} to={0.98}>
        <rect width="200" height="150" fill="#000" fillOpacity=".35" />
        <RangeSheet withAir={withAir} />
      </Phase>
    </svg>
  )
}
