import { LogicalSize } from '@tauri-apps/api/dpi'
import { emit, listen } from '@tauri-apps/api/event'
import {
  getCurrentWebviewWindow,
  WebviewWindow,
} from '@tauri-apps/api/webviewWindow'

import type { MapSelection } from '../components/MapPicker'
import type { ArtilleryMode } from '../types/artillery'
import type { ArtilleryCategory } from '../types/gameModel'
import type { Language } from '../types/settings'
import { DEV_BUILD } from './devBuild'
import type { MapTarget } from './journal'
import type { MrsiRun, TerrainStatus } from './mrsi'

/** The app runs as the Windows app (Tauri), not in a browser. */
export const isDesktop =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** The overlay window over the game opens with the address …#overlay. */
export const isOverlayWindow =
  typeof window !== 'undefined' && window.location.hash === '#overlay'

/** Global hotkeys (src-tauri/src/main.rs). */
export type HotkeyAction =
  | 'fire'
  | 'overlay'
  | 'input'
  | 'screen-markers'
  | 'mode'
  | 'next-target'
  | 'previous-target'

export const GLOBAL_HOTKEYS: readonly {
  keys: string
  action: HotkeyAction
}[] = [
  { keys: 'Ctrl + Alt + F', action: 'fire' },
  { keys: 'Ctrl + Alt + O', action: 'overlay' },
  { keys: 'Ctrl + Alt + D', action: 'input' },
  // Markers from the game screen: experimental, only in the development build
  ...(DEV_BUILD ? [{ keys: 'Ctrl + Alt + S', action: 'screen-markers' as const }] : []),
  { keys: 'Ctrl + Alt + M', action: 'mode' },
  { keys: 'Ctrl + Alt + N', action: 'next-target' },
  { keys: 'Ctrl + Alt + P', action: 'previous-target' },
]

/** Ready settings for the gun. */
export interface FiringSolution {
  charge: number
  mode: ArtilleryMode
  elevation: number
  // The final azimuth in the input units; null: not entered
  azimuth: string | null
  azimuthUnit: string
  tof: number
}

/** Input fields that can be changed from the overlay. */
export type OverlayField = 'distance' | 'azimuth' | 'ownHeight' | 'targetHeight'

/** What the overlay shows: the inputs of the main window and the solution. */
export interface OverlayState {
  language: Language
  title: string
  targetName: string | null
  mode: ArtilleryMode
  // The modes that have tables
  modes: ArtilleryMode[]
  // The charges that can reach the target
  charges: number[]
  // "mil" or "°": the units of the azimuth field
  azimuthUnit: string
  fields: Record<OverlayField, string>
  // The sum of the adjustment corrections, m, and the number of reports
  adjust: { range: number; lateral: number; count: number }
  // null: no solution
  solution: FiringSolution | null
  // The solution came from fire direction over Link: no input in the overlay is needed
  readOnly?: boolean
  // Time on target: the moment of the shot, ms; null: none
  fireAt?: number | null
  // Terrain on the shell path at the current charge
  terrain?: TerrainStatus
  // Simultaneous impact is selected: the plan and the start
  mrsi?: MrsiRun | null
  // The map in the main window is on: Input opens it in the overlay
  map?: {
    target: MapTarget | null
    reach: { min: number; max: number } | null
    category: ArtilleryCategory
    shellType?: string
  } | null
}

/** A command from the overlay to the main window. */
export type OverlayCommand =
  | { type: 'field'; field: OverlayField; value: string }
  | { type: 'charge'; charge: number }
  | { type: 'mode' }
  // A report along the gun line: > 0 means over / right of the target, m
  | { type: 'spot'; over: number; right: number }
  | { type: 'undo-adjust' }
  // The gun and the target were placed on the map in the overlay
  | { type: 'map'; selection: MapSelection }

/**
 * A subscription to a Tauri event. Returns an unsubscribe function, which can
 * be called even before the subscription has been set up.
 */
function subscribe<T>(event: string, handler: (payload: T) => void) {
  if (!isDesktop) return () => {}

  let cancelled = false
  let unlisten: (() => void) | null = null

  listen<T>(event, (e) => handler(e.payload))
    .then((stop) => {
      if (cancelled) stop()
      else unlisten = stop
    })
    .catch(() => {
      // No permission for events: work without them.
    })

  return () => {
    cancelled = true
    unlisten?.()
  }
}

export function onHotkey(handler: (action: HotkeyAction) => void) {
  return subscribe<HotkeyAction>('hotkey', handler)
}

export function publishSolution(state: OverlayState) {
  if (isDesktop) void emit('solution', state).catch(() => {})
}

export function onSolution(handler: (state: OverlayState) => void) {
  return subscribe<OverlayState>('solution', handler)
}

/** A shot not from the global key (a button, Link): a countdown in the overlay. */
export function notifyOverlayShot() {
  if (isDesktop) void emit('overlay-shot').catch(() => {})
}

export function onOverlayShot(handler: () => void) {
  return subscribe<null>('overlay-shot', () => handler())
}

export function sendOverlayCommand(command: OverlayCommand) {
  if (isDesktop) void emit('overlay-command', command).catch(() => {})
}

export function onOverlayCommand(handler: (command: OverlayCommand) => void) {
  return subscribe<OverlayCommand>('overlay-command', handler)
}

/** The overlay opened and asks for the current solution. */
export function requestSolution() {
  if (isDesktop) void emit('overlay-ready').catch(() => {})
}

export function onSolutionRequest(handler: () => void) {
  return subscribe<null>('overlay-ready', () => handler())
}

export async function toggleOverlay() {
  if (!isDesktop) return
  try {
    const overlay = await WebviewWindow.getByLabel('overlay')
    if (!overlay) return
    if (await overlay.isVisible()) await overlay.hide()
    else await overlay.show()
  } catch {
    // The window is unavailable: do nothing.
  }
}

/** Show the overlay over the game and take the keyboard focus. */
export async function focusCurrentWindow() {
  if (!isDesktop) return
  try {
    const current = getCurrentWebviewWindow()
    await current.show()
    await current.setFocus()
  } catch {
    // The window is unavailable: do nothing.
  }
}

/** The window size fits the content (the overlay opens the input panel). */
export async function resizeCurrentWindow(width: number, height: number) {
  if (!isDesktop) return
  try {
    await getCurrentWebviewWindow().setSize(new LogicalSize(width, height))
  } catch {
    // No permission or the window is unavailable: the old size stays.
  }
}

export async function hideCurrentWindow() {
  if (!isDesktop) return
  try {
    await getCurrentWebviewWindow().hide()
  } catch {
    // The window is unavailable: do nothing.
  }
}
