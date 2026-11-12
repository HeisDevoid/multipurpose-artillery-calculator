let audioContext: AudioContext | null = null

function context(): AudioContext {
  audioContext ??= new AudioContext()
  return audioContext
}

/** Events with sound. Each can get a file of its own. */
export type SoundEvent =
  | 'fire'
  | 'splash'
  | 'impact'
  | 'mrsiTick'
  | 'mrsiFire'
  | 'syncUpdate'

export const SOUND_EVENTS: readonly SoundEvent[] = [
  'fire',
  'splash',
  'impact',
  'mrsiTick',
  'mrsiFire',
  'syncUpdate',
]

// The standard signals: frequency, Hz, and duration, ms
const DEFAULT_BEEPS: Record<SoundEvent, [number, number]> = {
  fire: [440, 60],
  splash: [880, 150],
  impact: [660, 600],
  mrsiTick: [600, 80],
  mrsiFire: [900, 300],
  syncUpdate: [1200, 80],
}

// Own files: no bigger than this, IndexedDB is not unlimited
export const MAX_SOUND_BYTES = 2 * 1024 * 1024

const VOLUME_KEY = 'soundVolume'

function readVolume(): number {
  try {
    const value = Number(localStorage.getItem(VOLUME_KEY))
    return localStorage.getItem(VOLUME_KEY) !== null &&
      Number.isFinite(value)
      ? Math.min(1, Math.max(0, value))
      : 1
  } catch {
    return 1
  }
}

let volume = readVolume()

export function getVolume(): number {
  return volume
}

export function setVolume(value: number) {
  volume = Math.min(1, Math.max(0, value))
  try {
    localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    // Storage is unavailable: the volume lives until a reload.
  }
}

/** A short signal; silent if the browser has no sound. */
export function beep(frequency: number, durationMs: number) {
  try {
    const ctx = context()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    // Smooth edges, so that it does not click
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.2 * volume, ctx.currentTime + 0.01)
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + durationMs / 1000)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.05)
  } catch {
    // Sound is unavailable: the timer works without it.
  }
}

// ---- own sounds ----

export interface CustomSound {
  event: SoundEvent
  // The file name, to show in the settings
  name: string
  data: ArrayBuffer
}

const DB_NAME = 'artillery-sounds'
const STORE = 'sounds'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'event' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

// Files ready to play
const buffers = new Map<SoundEvent, AudioBuffer>()
const names = new Map<SoundEvent, string>()
const listeners = new Set<() => void>()

function changed() {
  listeners.forEach((listener) => listener())
}

/** A subscription to changes of own sounds (for the settings). */
export function onCustomSoundsChange(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The name of the own file for an event; null: the standard signal. */
export function customSoundName(event: SoundEvent): string | null {
  return names.get(event) ?? null
}

async function decode(data: ArrayBuffer): Promise<AudioBuffer> {
  // decodeAudioData takes the buffer: give it a copy
  return context().decodeAudioData(data.slice(0))
}

/** Load own sounds when the app starts. */
export async function loadCustomSounds() {
  try {
    const sounds = await run<CustomSound[]>('readonly', (store) =>
      store.getAll()
    )
    for (const sound of sounds) {
      if (!SOUND_EVENTS.includes(sound.event)) continue
      try {
        buffers.set(sound.event, await decode(sound.data))
        names.set(sound.event, sound.name)
      } catch {
        // The file cannot be read: the standard signal stays.
      }
    }
    changed()
  } catch {
    // No IndexedDB: standard signals only.
  }
}

export type SoundFileError = 'too-large' | 'not-audio'

/** Set an own file for an event. */
export async function setCustomSound(
  event: SoundEvent,
  file: File
): Promise<SoundFileError | null> {
  if (file.size > MAX_SOUND_BYTES) return 'too-large'
  const data = await file.arrayBuffer()
  let buffer: AudioBuffer
  try {
    buffer = await decode(data)
  } catch {
    return 'not-audio'
  }
  const sound: CustomSound = { event, name: file.name, data }
  try {
    await run('readwrite', (store) => store.put(sound))
  } catch {
    // Not saved: the sound works until a reload.
  }
  buffers.set(event, buffer)
  names.set(event, file.name)
  changed()
  return null
}

/** Bring back the standard signal. */
export async function resetCustomSound(event: SoundEvent) {
  buffers.delete(event)
  names.delete(event)
  try {
    await run('readwrite', (store) => store.delete(event))
  } catch {
    // No IndexedDB: nothing to remove.
  }
  changed()
}

/** The sound of an event: the own file if there is one, else the standard signal. */
export function playSound(event: SoundEvent) {
  const buffer = buffers.get(event)
  if (!buffer) {
    beep(...DEFAULT_BEEPS[event])
    return
  }
  try {
    const ctx = context()
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer
    gain.gain.value = volume
    source.connect(gain).connect(ctx.destination)
    source.start()
  } catch {
    // Sound is unavailable: the timer works without it.
  }
}
