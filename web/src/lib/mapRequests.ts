/**
 * Requests for new maps and votes for them, without a server and without GitHub.
 *
 * The data lives on the same public MQTT brokers as Link, as
 * retained messages:
 *   artcalc-maps/v1/req/<mod number>/info        - {"name": "…"}
 *   artcalc-maps/v1/req/<mod number>/v/<device>  - "1" (the vote of this device)
 * A reader gets everything the broker has accumulated, so the list is visible at once,
 * and the votes are counted by distinct devices. Writing and reading go to all
 * brokers at once: if one is unavailable or has forgotten the data, the others remember.
 *
 * Honestly about the limits: these are public brokers without accounts; one device has
 * one vote, but anyone who knows the device id format from the code
 * can inflate it; the app owner sees the list and decides.
 */

export const TOPIC_ROOT = 'artcalc-maps/v1/req'

/** What is suggested: a map or a weapon, each has a topic section of its own on the broker. */
export type RequestKind = 'map' | 'weapon'
export const REQUEST_ROOTS: Record<RequestKind, string> = {
  map: TOPIC_ROOT,
  weapon: 'artcalc-weapons/v1/req',
}
export const MAX_NAME = 60

export interface WorkshopLink {
  id: string
  url: string
}

function linkFor(id: string): WorkshopLink {
  return {
    id,
    url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
  }
}

/** A Steam Workshop mod link → the mod number and a "clean" link; otherwise null. */
export function parseWorkshopLink(input: string): WorkshopLink | null {
  const text = input.trim()
  if (!text) return null
  // A bare mod number works too
  const bare = text.match(/^\d{6,12}$/)
  if (bare) return linkFor(bare[0])
  const match = text.match(
    /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(?:sharedfiles|workshop)\/filedetails\/?\?(?:[^#\s]*&)?id=(\d{6,12})(?:[&#].*)?$/i
  )
  if (match) return linkFor(match[1])
  const proto = text.match(/^steam:\/\/url\/CommunityFilePage\/(\d{6,12})$/i)
  if (proto) return linkFor(proto[1])
  return null
}

export function infoTopic(workshopId: string, root = TOPIC_ROOT): string {
  return `${root}/${workshopId}/info`
}

export function voteTopic(
  workshopId: string,
  device: string,
  root = TOPIC_ROOT
): string {
  return `${root}/${workshopId}/v/${device}`
}

export type ParsedTopic =
  | { kind: 'info'; workshopId: string }
  | { kind: 'vote'; workshopId: string; device: string }

/** Parsing a message topic; null: not ours or with suspicious content. */
export function parseTopic(topic: string, root = TOPIC_ROOT): ParsedTopic | null {
  if (!topic.startsWith(`${root}/`)) return null
  const rest = topic.slice(root.length + 1).split('/')
  if (!/^\d{6,12}$/.test(rest[0] ?? '')) return null
  if (rest.length === 2 && rest[1] === 'info') {
    return { kind: 'info', workshopId: rest[0] }
  }
  if (rest.length === 3 && rest[1] === 'v' && /^[0-9a-f]{8,32}$/.test(rest[2])) {
    return { kind: 'vote', workshopId: rest[0], device: rest[2] }
  }
  return null
}

export interface MapRequest {
  workshopId: string
  name: string
  votes: number
  // Whether this device has voted
  mine: boolean
}

/** A summary of the broker messages: requests and votes (one device, one vote). */
export class Tally {
  private root: string

  constructor(root = TOPIC_ROOT) {
    this.root = root
  }

  private info = new Map<string, string>()
  private votes = new Map<string, Set<string>>()

  /** A broker message; an empty body on a retained topic is a withdrawal (of a vote or a request). */
  apply(topic: string, payload: string) {
    const parsed = parseTopic(topic, this.root)
    if (!parsed) return
    if (parsed.kind === 'info') {
      if (payload === '') {
        this.info.delete(parsed.workshopId)
        return
      }
      try {
        const data = JSON.parse(payload) as { name?: unknown }
        const name = typeof data.name === 'string' ? data.name.trim().slice(0, MAX_NAME) : ''
        // A request without a name is still shown, by the mod number
        this.info.set(parsed.workshopId, name || `Workshop ${parsed.workshopId}`)
      } catch {
        // Junk in the topic: skip it
      }
      return
    }
    const set = this.votes.get(parsed.workshopId) ?? new Set<string>()
    if (payload === '1') set.add(parsed.device)
    else set.delete(parsed.device)
    this.votes.set(parsed.workshopId, set)
  }

  /** The request list by descending votes (on a tie, by name). */
  snapshot(device: string): MapRequest[] {
    return [...this.info.entries()]
      .map(([workshopId, name]) => {
        const set = this.votes.get(workshopId)
        return {
          workshopId,
          name,
          votes: set?.size ?? 0,
          mine: set?.has(device) ?? false,
        }
      })
      .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
  }
}

export type RequestsStatus = 'connecting' | 'ready' | 'offline'

export interface RequestsSession {
  /** Vote for a request (or remove the vote). */
  vote: (workshopId: string, on: boolean) => void
  /** A new request with the first vote. */
  suggest: (link: WorkshopLink, name: string) => void
  close: () => void
}

/**
 * Open a session: connect to all brokers, collect requests and votes.
 * onUpdate is called on every change, onStatus when the state changes.
 */
export async function openRequests(
  servers: readonly string[],
  device: string,
  onUpdate: (requests: MapRequest[]) => void,
  onStatus: (status: RequestsStatus) => void,
  kind: RequestKind = 'map'
): Promise<RequestsSession> {
  const root = REQUEST_ROOTS[kind]
  const mqtt = await import('mqtt')
  // The mqtt build is CommonJS: in development Vite serves it only as default
  const connect = mqtt.connect ?? mqtt.default.connect

  const tally = new Tally(root)
  const clients: ReturnType<typeof connect>[] = []
  let online = 0
  let closed = false
  let settle: ReturnType<typeof setTimeout> | undefined

  const emit = () => {
    if (!closed) onUpdate(tally.snapshot(device))
  }

  onStatus('connecting')
  const timeout = setTimeout(() => {
    if (online === 0 && !closed) onStatus('offline')
  }, 9000)

  for (const [index, url] of servers.entries()) {
    const client = connect(url, {
      clientId: `artcalc_${kind}_${device}_${index}`,
      reconnectPeriod: 4000,
      connectTimeout: 8000,
      clean: true,
    })
    clients.push(client)
    client.on('connect', () => {
      online += 1
      client.subscribe(`${root}/#`, { qos: 1 })
      // The broker sends what it has accumulated in a batch: show it when the batch has settled
      clearTimeout(settle)
      settle = setTimeout(() => {
        if (!closed) onStatus('ready')
        emit()
      }, 1200)
    })
    client.on('close', () => {
      online = Math.max(0, online - 1)
      if (online === 0 && !closed) onStatus('connecting')
    })
    client.on('error', () => {})
    client.on('message', (topic, payload) => {
      if (payload.length > 400) return
      tally.apply(topic, payload.toString())
      emit()
    })
  }

  function publishAll(topic: string, payload: string) {
    // Own changes are visible locally at once, without waiting for the broker
    tally.apply(topic, payload)
    emit()
    for (const client of clients) {
      if (client.connected) client.publish(topic, payload, { qos: 1, retain: true })
    }
  }

  return {
    vote(workshopId, on) {
      publishAll(voteTopic(workshopId, device, root), on ? '1' : '')
    },
    suggest(link, name) {
      publishAll(
        infoTopic(link.id, root),
        JSON.stringify({ name: name.trim().slice(0, MAX_NAME) })
      )
      publishAll(voteTopic(link.id, device, root), '1')
    },
    close() {
      closed = true
      clearTimeout(timeout)
      clearTimeout(settle)
      for (const client of clients) client.end(true)
    },
  }
}
