import type { ReactNode } from 'react'

/**
 * Анимации для вопроса «есть ли на сервере сопротивление воздуха»: как в
 * игре открыть таблицу стрельбы ACE (меню на себя → пункт с названием
 * орудия → таблица) и чем отличается пункт со звёздочкой. Надписи — как в
 * игре, по-английски.
 */

const LOOP = '7s'
const FONT = 'Inter, system-ui, sans-serif'
const MONO = 'ui-monospace, Consolas, monospace'

// Видно на доле цикла [from, to] (с плавным появлением и исчезновением)
function Phase({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  return (
    <g opacity="0">
      <animate
        attributeName="opacity"
        dur={LOOP}
        repeatCount="indefinite"
        keyTimes={`0;${from};${from + 0.04};${to - 0.04};${to};1`}
        values="0;0;1;1;0;0"
      />
      {children}
    </g>
  )
}

// Пейзаж игры: небо, холмы, грунтовая дорога
function Scene() {
  return (
    <>
      <defs>
        <linearGradient id="ace-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb0dc" />
          <stop offset="1" stopColor="#cfe0ec" />
        </linearGradient>
        <linearGradient id="ace-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bba67f" />
          <stop offset="1" stopColor="#d8cbb1" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#ace-sky)" />
      <path d="M0 74 Q 60 62 120 70 T 220 66 T 320 72 V 86 H0z" fill="#8c9a7c" />
      <rect y="80" width="320" height="100" fill="url(#ace-ground)" />
      <path d="M150 80 L 170 80 L 250 180 L 70 180z" fill="#d9ccb2" opacity=".7" />
      <circle cx="58" cy="82" r="13" fill="#4f6138" />
      <circle cx="76" cy="85" r="9" fill="#5b6e41" />
      <circle cx="262" cy="80" r="10" fill="#4f6138" />
    </>
  )
}

// Пункт меню ACE: значок и подпись под ним (белые, с тенью, как в игре)
function MenuItem({ x, y, label, icon = 'dot', bright = false }: { x: number; y: number; label: string; icon?: 'dot' | 'table' | 'self' | 'plus'; bright?: boolean }) {
  return (
    <g fontFamily={FONT} textAnchor="middle" style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,.7))' }}>
      {icon === 'dot' && <circle cx={x} cy={y} r="2" fill="#fff" />}
      {icon === 'plus' && <path d={`M${x - 3} ${y}h6M${x} ${y - 3}v6`} stroke="#fff" strokeWidth="1.6" />}
      {icon === 'self' && <path d={`M${x - 4} ${y + 2}l4-4 4 4M${x - 3} ${y + 3}h6`} stroke="#fff" strokeWidth="1.2" fill="none" />}
      {icon === 'table' && (
        <g>
          <rect x={x - 5} y={y - 4} width="10" height="8" rx="1" fill="#fff" stroke="#c84040" strokeWidth=".8" />
          <path d={`M${x - 5} ${y - 1.5}h10M${x - 1.5} ${y - 4}v8M${x + 1.8} ${y - 4}v8`} stroke="#c84040" strokeWidth=".5" />
        </g>
      )}
      <text x={x} y={y + 10} fontSize="6.5" fill={bright ? '#fff' : 'rgba(255,255,255,.88)'} fontWeight={bright ? 700 : 500}>
        {label}
      </text>
    </g>
  )
}

// Лист таблицы стрельбы ACE: слева HIGH/LOW и заряды, справа белая таблица
function RangeSheet({ x, y, weather }: { x: number; y: number; weather: boolean }) {
  const rows = weather
    ? [
        ['850', '1395', '30.3', '2.7', '-6.1', '5.9'],
        ['900', '1383', '30.2', '2.8', '-6.3', '6.0'],
        ['950', '1370', '30.1', '2.9', '-6.4', '6.2'],
        ['1000', '1358', '29.9', '3.0', '-6.6', '6.3'],
      ]
    : [
        ['850', '1417', '30.9', '-', '-', '-'],
        ['900', '1406', '30.8', '-', '-', '-'],
        ['950', '1394', '30.7', '-', '-', '-'],
        ['1000', '1383', '30.7', '-', '-', '-'],
      ]
  const cols = [8, 30, 52, 78, 100, 122]
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="44" height="118" fill="#0d0d0d" />
      <rect x="2" y="2" width="19" height="9" fill="#1e1e1e" />
      <text x="11.5" y="8.6" fontSize="4.6" fill="#fff" textAnchor="middle" fontFamily={FONT}>HIGH</text>
      <text x="32" y="8.6" fontSize="4.6" fill="#666" textAnchor="middle" fontFamily={FONT}>LOW</text>
      {[0, 1, 2, 3, 4].map((n) => (
        <g key={n}>
          {n === 0 && <rect x="2" y={14} width="40" height="7" fill="#eee" />}
          <text x="4" y={19.4 + n * 8} fontSize="4.6" fill={n === 0 ? '#111' : '#ddd'} fontFamily={FONT}>[Charge {n}]</text>
        </g>
      ))}
      <rect x="44" width="146" height="118" fill="#fbfbf8" />
      {['RANGE', 'ELEV', 'TIME', 'WIND', 'TEMP', 'DENS'].map((h, i) => (
        <text key={h} x={44 + cols[i] + 6} y="10" fontSize="4.2" fill="#222" textAnchor="middle" fontFamily={FONT} fontWeight="700">{h}</text>
      ))}
      <path d="M44 14H190" stroke="#999" strokeWidth=".4" />
      {/* Погодные столбцы: серая полоса, как в игре */}
      <rect x="114" y="14" width="22" height="104" fill="#e2e2e2" />
      {rows.map((row, r) => (
        <g key={r}>
          {row.map((v, i) => (
            <text key={i} x={44 + cols[i] + 6} y={24 + r * 9} fontSize="4.8" fill={i >= 3 && weather ? '#0a7a2f' : '#222'} textAnchor="middle" fontFamily={MONO} fontWeight={i >= 3 && weather ? 700 : 400}>
              {v}
            </text>
          ))}
        </g>
      ))}
      <text x="117" y="66" fontSize="4.2" fill="#888" textAnchor="middle" fontFamily={MONO}>⋮</text>
    </g>
  )
}

/** Как открыть таблицу стрельбы ACE в игре: меню на себя → пункт орудия → таблица. */
export function AceMenuDemo() {
  return (
    <svg viewBox="0 0 320 180" className="block w-full rounded-md" aria-hidden="true">
      <Scene />
      {/* Клавиши меню ACE на себя (по умолчанию) */}
      <Phase from={0.0} to={0.2}>
        <g fontFamily={FONT} fontSize="9" fontWeight="700" textAnchor="middle">
          <rect x="118" y="20" width="36" height="16" rx="3" fill="#111" stroke="#fff" strokeOpacity=".5" />
          <text x="136" y="31" fill="#fff">Ctrl</text>
          <text x="160" y="31" fill="#fff">+</text>
          <rect x="166" y="20" width="36" height="16" rx="3" fill="#111" stroke="#fff" strokeOpacity=".5" />
          <text x="184" y="31" fill="#fff">Win</text>
        </g>
      </Phase>
      {/* Меню ACE на себя */}
      <Phase from={0.08} to={0.62}>
        <MenuItem x={160} y={86} label="Self Actions" icon="self" />
        <MenuItem x={160} y={50} label="Medical" icon="plus" />
        <MenuItem x={210} y={66} label="Gestures" />
        <MenuItem x={104} y={68} label="Accessories" />
        <MenuItem x={110} y={112} label="Equipment" />
        <MenuItem x={212} y={110} label="Team Management" />
        <MenuItem x={124} y={142} label="Open Kestrel 4500" />
        <MenuItem x={178} y={140} label="Sholef" icon="table" />
      </Phase>
      {/* Наведение на пункт с названием орудия */}
      <Phase from={0.4} to={0.62}>
        <circle cx="178" cy="140" r="10" fill="none" stroke="#ffb020" strokeWidth="1.4">
          <animate attributeName="r" values="7;11;7" dur="1s" repeatCount="indefinite" />
        </circle>
      </Phase>
      {/* Таблица стрельбы */}
      <Phase from={0.6} to={0.97}>
        <RangeSheet x={65} y={30} weather={false} />
      </Phase>
      {/* Курсор */}
      <g style={{ filter: 'drop-shadow(0 0 1px rgba(0,0,0,.8))' }}>
        <path d="M0 0 L0 9 L2.5 6.8 L4.5 11 L6 10.3 L4 6.2 L7.5 6.2 Z" fill="#fff" stroke="#333" strokeWidth=".4">
          <animateTransform
            attributeName="transform"
            type="translate"
            dur={LOOP}
            repeatCount="indefinite"
            keyTimes="0;0.15;0.38;0.6;0.8;1"
            values="160 92;160 92;179 141;179 141;150 120;160 92"
          />
        </path>
      </g>
    </svg>
  )
}

/**
 * Пункт меню со звёздочкой и без: со звёздочкой у сервера сопротивление
 * воздуха, и в таблице заполнены погодные столбцы.
 */
export function AsteriskDemo({ withAir }: { withAir: boolean }) {
  return (
    <svg viewBox="0 0 200 156" className="block w-full rounded-md" aria-hidden="true">
      <rect width="200" height="34" fill="#a99572" />
      <rect y="0" width="200" height="34" fill="url(#ace-ground-small)" />
      <defs>
        <linearGradient id="ace-ground-small" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9c8763" />
          <stop offset="1" stopColor="#bba67f" />
        </linearGradient>
      </defs>
      {/* Пункт меню: значок таблицы и название */}
      <g fontFamily={FONT} style={{ filter: 'drop-shadow(0 0 1.5px rgba(0,0,0,.7))' }}>
        <rect x="56" y="8" width="12" height="10" rx="1" fill="#fff" stroke="#c84040" strokeWidth=".9" />
        <path d="M56 11.5h12M60 8v10M64 8v10" stroke="#c84040" strokeWidth=".6" />
        <text x="74" y="16.5" fontSize="10" fill="#fff" fontWeight="700">Sholef</text>
        {withAir && (
          <g>
            <circle cx="111" cy="12.5" r="6" fill="none" stroke="#ffb020" strokeWidth="1.4">
              <animate attributeName="r" values="5;9;5" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;.25;1" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <text x="108" y="18" fontSize="12" fill="#ffb020" fontWeight="800">*</text>
          </g>
        )}
      </g>
      <g transform="translate(5 36) scale(1)">
        <RangeSheet x={0} y={0} weather={withAir} />
      </g>
    </svg>
  )
}
