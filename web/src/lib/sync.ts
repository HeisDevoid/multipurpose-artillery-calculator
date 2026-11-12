import type { ArtilleryMode } from '../types/artillery'
import { parseMarker, type MapMarker } from './markers'
import type { MrsiShot, TerrainStatus } from './mrsi'

/**
 * Link between fire direction and the gunner: shared by all devices.
 *
 * Devices meet in a "room" on a public MQTT broker.
 * The room code (PBKDF2) gives an AES-GCM key and a channel name:
 * the broker and outsiders see only the cipher, and the code cannot be guessed
 * from the channel name faster than by brute-forcing PBKDF2.
 */

/** Who is on this device: the one who calculates or the one who fires. */
export type SyncRole = 'computer' | 'gunner'

export const SYNC_ROLES: readonly SyncRole[] = ['computer', 'gunner']

/** The published site: an invitation link from the Windows app leads here. */
export const PUBLIC_SITE_URL =
  'https://heisdevoid.github.io/multipurpose-artillery-calculator/'

/** Public MQTT brokers over WebSocket (no registration). */
export const SYNC_SERVERS = [
  { id: 'hivemq', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { id: 'emqx', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 'mosquitto', url: 'wss://test.mosquitto.org:8081' },
] as const

export type SyncServerId = (typeof SYNC_SERVERS)[number]['id']

export const SYNC_SERVER_IDS: readonly SyncServerId[] = SYNC_SERVERS.map(
  (server) => server.id
)

/** The settings fire direction sends to the gunner. */
export interface SyncSolution {
  title: string
  targetName: string | null
  charge: number
  mode: ArtilleryMode
  elevation: number
  azimuth: string | null
  azimuthUnit: string
  tof: number
  // Time on target: the moment of impact, ms (the device clock); null: none
  tot?: number | null
  // Terrain on the shell path: the gunner sees that the fire is tight or blocked
  terrain?: TerrainStatus
  // Simultaneous impact: the shot plan (the start is on the "shot" signal)
  mrsi?: { shots: MrsiShot[] } | null
}

export type SyncMessage =
  // Fire direction → gunners; stored on the broker (retain) for latecomers.
  // null: no solution (the target was cleared).
  | { kind: 'solution'; from: string; sentAt: number; solution: SyncSolution | null }
  // A shot from any device: a countdown to impact for everyone
  | { kind: 'shot'; from: string; sentAt: number }
  // "I am online" once every few seconds
  | { kind: 'hello'; from: string; sentAt: number; role: SyncRole }
  // A map marker; stored on the broker (retain) in its own channel
  | { kind: 'marker'; from: string; sentAt: number; marker: MapMarker }

// No look-alike characters: 0/O, 1/I/L, since the code is dictated by voice.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const CODE_LENGTH = 8

/** A new random room code of the XXXX-XXXX form. */
export function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  const chars = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length])
  return formatRoomCode(chars.join(''))
}

/** The code in the canonical form: capitals, no spaces or dashes. */
export function normalizeRoomCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s-]/g, '')
}

export function formatRoomCode(value: string): string {
  const code = normalizeRoomCode(value)
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code
}

export function isValidRoomCode(value: string): boolean {
  const code = normalizeRoomCode(value)
  return (
    code.length === CODE_LENGTH &&
    [...code].every((char) => ALPHABET.includes(char))
  )
}

export interface Room {
  // The channel on the broker: <topic>/state and <topic>/events
  topic: string
  key: CryptoKey
}

const SALT = new TextEncoder().encode('artillery-calculator/sync/v1')
const ITERATIONS = 100_000

/** The room channel and key from the code. */
export async function deriveRoom(code: string): Promise<Room> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizeRoomCode(code)),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: SALT, iterations: ITERATIONS },
      material,
      384
    )
  )
  // The first 256 bits are the key, the remaining 128 the channel name
  const key = await crypto.subtle.importKey(
    'raw',
    bits.slice(0, 32),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
  const id = Array.from(bits.slice(32), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return { topic: `artillery-calculator/v1/${id}`, key }
}

const IV_LENGTH = 12

/** A message → nonce + AES-GCM cipher. */
export async function encryptMessage(
  key: CryptoKey,
  message: SyncMessage
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const data = new TextEncoder().encode(JSON.stringify(message))
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  )
  const packet = new Uint8Array(IV_LENGTH + sealed.length)
  packet.set(iv)
  packet.set(sealed, IV_LENGTH)
  return packet
}

/** Decryption; null: another key, damage or not our format. */
export async function decryptMessage(
  key: CryptoKey,
  packet: Uint8Array
): Promise<SyncMessage | null> {
  if (packet.length <= IV_LENGTH) return null
  try {
    const data = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: packet.slice(0, IV_LENGTH) },
      key,
      packet.slice(IV_LENGTH)
    )
    return parseMessage(JSON.parse(new TextDecoder().decode(data)))
  } catch {
    return null
  }
}

/** A packet ↔ text for the broker (base64). */
export function packetToText(packet: Uint8Array): string {
  let binary = ''
  for (const byte of packet) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function textToPacket(text: string): Uint8Array {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
  } catch {
    return new Uint8Array()
  }
}

/** An invitation by link: …?room=XXXX-XXXX&server=hivemq, for the gunner. */
export function readInvite(
  search: string
): { code: string; server: SyncServerId } | null {
  const params = new URLSearchParams(search)
  const code = params.get('room') ?? ''
  if (!isValidRoomCode(code)) return null
  const server = SYNC_SERVER_IDS.find((id) => id === params.get('server'))
  return { code: formatRoomCode(code), server: server ?? 'hivemq' }
}

/** An invitation link to the room for the gunner. */
export function inviteLink(
  page: string,
  code: string,
  server: SyncServerId
): string {
  const url = new URL(page)
  url.hash = ''
  url.search = new URLSearchParams({
    room: formatRoomCode(code),
    server,
  }).toString()
  return url.toString()
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isString = (value: unknown): value is string => typeof value === 'string'

function parseMrsiShots(value: unknown): MrsiShot[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const shots: MrsiShot[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) return null
    const shot = item as Record<string, unknown>
    if (
      !(shot.mode === 'HIGH' || shot.mode === 'LOW') ||
      !isNumber(shot.charge) ||
      !isNumber(shot.elevation) ||
      !isNumber(shot.tof) ||
      !isNumber(shot.fireAt)
    ) {
      return null
    }
    shots.push({
      mode: shot.mode,
      charge: shot.charge,
      elevation: shot.elevation,
      tof: shot.tof,
      fireAt: shot.fireAt,
    })
  }
  return shots
}

function parseSolution(value: unknown): SyncSolution | null | undefined {
  if (value === null) return null
  if (typeof value !== 'object') return undefined
  const s = value as Record<string, unknown>
  const valid =
    isString(s.title) &&
    (s.targetName === null || isString(s.targetName)) &&
    isNumber(s.charge) &&
    (s.mode === 'HIGH' || s.mode === 'LOW') &&
    isNumber(s.elevation) &&
    (s.azimuth === null || isString(s.azimuth)) &&
    isString(s.azimuthUnit) &&
    isNumber(s.tof) &&
    s.tof > 0 &&
    (s.tot === undefined || s.tot === null || isNumber(s.tot))
  if (!valid) return undefined
  const mrsiShots =
    typeof s.mrsi === 'object' && s.mrsi !== null
      ? parseMrsiShots((s.mrsi as Record<string, unknown>).shots)
      : null
  return {
    title: s.title as string,
    targetName: s.targetName as string | null,
    charge: s.charge as number,
    mode: s.mode as ArtilleryMode,
    elevation: s.elevation as number,
    azimuth: s.azimuth as string | null,
    azimuthUnit: s.azimuthUnit as string,
    tof: s.tof as number,
    tot: (s.tot as number | null | undefined) ?? null,
    // Fields of newer versions: old ones lack them, wrong ones are not shown
    ...(s.terrain === 'tight' || s.terrain === 'blocked' ? { terrain: s.terrain } : {}),
    ...(mrsiShots ? { mrsi: { shots: mrsiShots } } : {}),
  }
}

/** Validation of the message shape (another app version, junk). */
export function parseMessage(value: unknown): SyncMessage | null {
  if (typeof value !== 'object' || value === null) return null
  const m = value as Record<string, unknown>
  if (!isString(m.from) || !isNumber(m.sentAt)) return null
  const base = { from: m.from, sentAt: m.sentAt }

  switch (m.kind) {
    case 'solution': {
      const solution = parseSolution(m.solution)
      return solution === undefined ? null : { kind: 'solution', ...base, solution }
    }
    case 'shot':
      return { kind: 'shot', ...base }
    case 'marker': {
      const marker = parseMarker(m.marker)
      return marker ? { kind: 'marker', ...base, marker } : null
    }
    case 'hello':
      return m.role === 'computer' || m.role === 'gunner'
        ? { kind: 'hello', ...base, role: m.role }
        : null
    default:
      return null
  }
}

/** How old a "shot" or "I am online" may arrive (device clocks differ slightly). */
export const MAX_EVENT_AGE_MS = 120_000

/**
 * Replay protection: the cipher cannot be forged, but an intercepted packet can be
 * sent to the channel again. A replay of the same message, old shots and
 * a solution older than the one shown are dropped.
 */
export class ReplayGuard {
  private seen = new Set<string>()
  private lastSolutionAt = 0

  accept(message: SyncMessage, now: number): boolean {
    if (
      (message.kind === 'shot' || message.kind === 'hello') &&
      Math.abs(now - message.sentAt) > MAX_EVENT_AGE_MS
    ) {
      return false
    }
    const key = `${message.kind}|${message.from}|${message.sentAt}`
    if (this.seen.has(key)) return false
    if (message.kind === 'solution') {
      if (message.sentAt < this.lastSolutionAt) return false
      this.lastSolutionAt = message.sentAt
    }
    if (this.seen.size > 1000) this.seen.clear()
    this.seen.add(key)
    return true
  }
}
