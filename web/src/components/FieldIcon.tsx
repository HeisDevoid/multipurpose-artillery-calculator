import type { ReactNode } from 'react'

/**
 * Hint icons at the input fields: it is clear at once what goes where, so that
 * nothing is mixed up (distance with height, azimuth with elevation).
 * Line icons on a 24×24 grid, they inherit the text colour.
 */
const paths = {
  // a ruler: the distance to the target
  distance: (
    <>
      <path d="M3 8.5h18v7H3z" />
      <path d="M7 8.5v3M11 8.5v2M15 8.5v3M19 8.5v2" />
    </>
  ),
  // a compass: azimuth
  azimuth: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  // elevation: the barrel angle above the horizon
  elevation: (
    <>
      <path d="M3 19h18" />
      <path d="M5 19 17 8" />
      <path d="M11 19a6 6 0 0 0-1.6-4.1" />
    </>
  ),
  // a stopwatch: time of flight
  time: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M10 3h4" />
    </>
  ),
  // charge: a cartridge case
  charge: (
    <>
      <path d="M9 3.5h6v3.5l1.2 2.2V20H7.8V9.2L9 7z" />
      <path d="M7.8 16h8.4" />
    </>
  ),
  // high trajectory: an arc
  trajectory: (
    <>
      <path d="M3 19c3-12 15-12 18 0" />
      <circle cx="3" cy="19" r="0.8" />
      <circle cx="21" cy="19" r="0.8" />
    </>
  ),
  // a gun on a hill: the position height
  gunHeight: (
    <>
      <path d="M2.5 20.5 8.5 11l3.5 5 2.5-3.2 6.5 7.7z" />
      <path d="M13 6.5 19 3.5" />
      <circle cx="12" cy="7" r="1.3" />
    </>
  ),
  // a target on a hill: the target height
  targetHeight: (
    <>
      <path d="M2.5 20.5 8.5 11l3.5 5 2.5-3.2 6.5 7.7z" />
      <circle cx="16.5" cy="6.5" r="3.2" />
      <path d="M16.5 2.5v2M16.5 8.5v2M12.5 6.5h2M18.5 6.5h2" />
    </>
  ),
  // gun
  weapon: (
    <>
      <path d="M4 17.5 16.5 6.5l2.2 2.4L7.5 19.5z" />
      <path d="M2.5 20.5h8" />
      <path d="M17.5 5.5 20.5 3" />
    </>
  ),
  // shell
  shell: (
    <>
      <path d="M12 2.5c3 2.5 4 5.5 4 8.5v8.5H8V11c0-3 1-6 4-8.5z" />
      <path d="M8 15.5h8" />
    </>
  ),
  // wind
  wind: (
    <>
      <path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 13.5h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 18h7" />
    </>
  ),
  // wind direction: an arrow around a circle
  windDirection: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 17V7M8.5 10.5 12 7l3.5 3.5" />
    </>
  ),
  temperature: (
    <>
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  pressure: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 12 3.5-3.5" />
      <path d="M7.5 15.5h9" />
    </>
  ),
  // map: grid coordinates
  grid: (
    <>
      <path d="M3.5 3.5h17v17h-17z" />
      <path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" />
    </>
  ),
  // correction: the burst offset
  correction: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    </>
  ),
  // observer
  observer: (
    <>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.7-1.5" />
    </>
  ),
  // the interval between shots / reload
  reload: (
    <>
      <path d="M20 11a8 8 0 1 0-1.6 5.6" />
      <path d="M20.5 4.5V11H14" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  // the gun on the map: a blue dot with a ring
  gun: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <circle cx="12" cy="12" r="8" />
    </>
  ),
  // target: a crosshair
  target: (
    <>
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2.5v4.5M12 17v4.5M2.5 12H7M17 12h4.5" />
    </>
  ),
  // marker: a pin
  marker: (
    <>
      <path d="M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11 6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  // line of fire: a polyline with dots
  line: (
    <>
      <path d="M4 18 10 9l5 6 5-9" />
      <circle cx="4" cy="18" r="1.3" />
      <circle cx="20" cy="6" r="1.3" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  fire: (
    <>
      <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.3 2-4.5.3 1.2.9 2 1.8 2.5C10.6 8 10.8 5.5 12 3z" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  // Combat screen: a monitor with a sight (not to be confused with "Fit", the corner frame)
  combat: (
    <>
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" />
      <circle cx="12" cy="10.75" r="3" />
      <path d="M12 7.5v1.2M12 12.8V14M8.75 10.75H10M14 10.75h1.25M8 20.5h8M12 17v3.5" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  import: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  export: <path d="M12 15V4M7 9l5-5 5 5M5 20h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  undo: <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5M9 9h6v6H9z" />,
  map: (
    <>
      <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5-5.5 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  weather: (
    <path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a4.8 4.8 0 0 1 0 9.5z" />
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 10h17M3.5 15h17M9.5 4.5v15" />
    </>
  ),
  journal: (
    <>
      <path d="M6 3.5h12v17H6z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  stack: (
    <>
      <path d="m12 4 9 4.5-9 4.5-9-4.5z" />
      <path d="m3 13 9 4.5 9-4.5M3 17l9 4.5 9-4.5" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  flare: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  starFilled: <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9M12 16.8h.01" />
    </>
  ),
  desktop: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M9 20.5h6M12 16.5v4" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.6-3.6 3.4-5.5 7-5.5s6.4 1.9 7 5.5" />
    </>
  ),
  // A heart: support the project (Donatello)
  heart: <path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z" />,
  steam: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="15.2" cy="9.4" r="2.4" />
      <circle cx="9.2" cy="14.6" r="1.8" />
      <path d="m10.6 13.5 3-2.4" />
    </>
  ),
  // The best charge: scales, a balance between speed and precision
  balance: (
    <>
      <path d="M12 4v16M7 20h10M5 7.5h14" />
      <path d="M7.5 7.5 4.5 14h6zM16.5 7.5 13.5 14h6z" />
    </>
  ),
  // Trajectories: the high one is a steep arc, the low one is flat, auto is both
  trajectoryHigh: <path d="M3 19C6 4.5 18 4.5 21 19" />,
  trajectoryLow: <path d="M3 18c4-6 14-6 18 0" />,
  // Auto: arrows in a circle, "it picks by itself"
  autoCycle: (
    <>
      <path d="M20 12a8 8 0 0 1-13.7 5.6M4 12A8 8 0 0 1 17.7 6.4" />
      <path d="M17.7 3v3.4h-3.4M6.3 21v-3.4h3.4" />
    </>
  ),
  // Wind: the speed is a gauge needle; along the line of fire and across it
  speed: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-5" />
      <circle cx="12" cy="17" r="1" />
    </>
  ),
  along: <path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4" />,
  across: <path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  // Tutorial
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4.5 4.5v13c3.5 0 6 .5 7.5 2 1.5-1.5 4-2 7.5-2v-13C16 4.5 13.5 5 12 6.5z" />
      <path d="M12 6.5v13" />
    </>
  ),
  // pencil
  pen: <path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19zM14 7l3 3" />,
  // a straight drawing line
  drawLine: (
    <>
      <path d="M5 19 19 5" />
      <circle cx="5" cy="19" r="1.3" />
      <circle cx="19" cy="5" r="1.3" />
    </>
  ),
  // eraser
  eraser: <path d="M8 20h12M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 20H7.5l-2-2a2 2 0 0 1 0-2.8z" />,
  // satellite: a dish with rays
  satellite: (
    <>
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" transform="rotate(45 12 12)" />
      <path d="M5.5 5.5 8.5 8.5M15.5 15.5l3 3M4 10a6 6 0 0 1 6-6M2 10a8 8 0 0 1 8-8M14 20a6 6 0 0 0 6-6M14 22a8 8 0 0 0 8-8" />
    </>
  ),
  // topographic map: contour lines
  topo: (
    <>
      <path d="M3 17c3-1 4-5 8-5s5 3 10 1" />
      <path d="M5 21c3-1 4-3 7-3s5 1 8 0" />
      <path d="M6 12c1-4 4-7 8-7s5 3 4 6" />
    </>
  ),
  // terrain: two peaks
  mountain: (
    <>
      <path d="M2.5 19.5 9 8l4.2 7.2" />
      <path d="M10.8 19.5 15.5 11l6 8.5z" />
      <path d="M2.5 19.5h19" />
    </>
  ),
  // warning: a triangle with an exclamation mark
  warning: (
    <>
      <path d="M12 3.5 2.5 20h19z" />
      <path d="M12 10v4.5M12 17.5h.01" />
    </>
  ),
  // verified: a shield with a check mark
  shieldCheck: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  // expand / collapse
  chevron: <path d="m6 9 6 6 6-6" />,
  // example: a "play" triangle
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  // where I can hit: the field of fire from the gun
  reachFrom: (
    <>
      <circle cx="12" cy="19" r="1.7" />
      <path d="M10.9 17.6 4.4 6.3M13.1 17.6l6.5-11.3" />
      <path d="M4.4 6.3a15 15 0 0 1 15.2 0" />
      <path d="M8 12.6a8.2 8.2 0 0 1 8 0" strokeDasharray="1.6 2.2" />
    </>
  ),
  // where to stand: a pin over a spot circle
  standTo: (
    <>
      <path d="M12 15.5s4.6-3.9 4.6-7.7a4.6 4.6 0 1 0-9.2 0c0 3.8 4.6 7.7 4.6 7.7z" />
      <circle cx="12" cy="7.8" r="1.6" />
      <path d="M7 17.2c-2 .5-3.2 1.2-3.2 2s3.7 2.3 8.2 2.3 8.2-1 8.2-2.3-1.2-1.5-3.2-2" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type FieldIconName = keyof typeof paths

export function FieldIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: FieldIconName
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {paths[name]}
    </svg>
  )
}
