import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { MqttClient } from 'mqtt'

import { readStored, readStoredText, writeStored } from '../lib/input'
import {
  applyRemoteMarker,
  onLocalMarkerChange,
  ownMarkers,
  type MapMarker,
} from '../lib/markers'
import {
  decryptMessage,
  ReplayGuard,
  deriveRoom,
  encryptMessage,
  formatRoomCode,
  isValidRoomCode,
  packetToText,
  readInvite,
  textToPacket,
  SYNC_ROLES,
  SYNC_SERVER_IDS,
  SYNC_SERVERS,
  type Room,
  type SyncMessage,
  type SyncRole,
  type SyncServerId,
  type SyncSolution,
} from '../lib/sync'
import {
  SyncContext,
  type RemoteSolution,
  type SyncApi,
  type SyncPeer,
  type SyncStatus,
} from '../lib/syncContext'

// "I am online" this often; a device counts as gone without an answer
const HELLO_INTERVAL_MS = 10_000
const PEER_TIMEOUT_MS = 35_000

interface Connection {
  client: MqttClient
  room: Room
}

/**
 * Link between fire direction and the gunner: one connection for the whole app,
 * it survives page changes.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const invite = useMemo(() => readInvite(window.location.search), [])

  const [role, setRoleState] = useState<SyncRole>(() =>
    invite ? 'gunner' : readStored('syncRole', SYNC_ROLES, 'computer')
  )
  const [code, setCodeState] = useState(
    () => invite?.code ?? readStoredText('syncCode')
  )
  const [server, setServerState] = useState<SyncServerId>(
    () => invite?.server ?? readStored('syncServer', SYNC_SERVER_IDS, 'hivemq')
  )
  const [callsign, setCallsign] = useState(() =>
    readStoredText('syncCallsign')
  )
  const [enabled, setEnabled] = useState(
    () => invite !== null || readStoredText('syncEnabled') === 'true'
  )

  // The connection state from the broker; null: no connection yet
  const [link, setLink] = useState<SyncStatus | null>(null)
  const ready = enabled && isValidRoomCode(code)
  const status: SyncStatus = ready ? (link ?? 'connecting') : 'off'
  const [peerMap, setPeerMap] = useState<Record<string, SyncPeer>>({})
  const [remote, setRemote] = useState<RemoteSolution | null>(null)
  const [lastSharedAt, setLastSharedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  // A unique tab number: the broker sends own messages back
  const clientId = useMemo(
    () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
      b.toString(16).padStart(2, '0')
    ).join(''),
    []
  )
  const connectionRef = useRef<Connection | null>(null)
  const shotHandlers = useRef(new Set<() => void>())
  // The last fire direction solution: sent again after a reconnect
  const sharedRef = useRef<{ json: string; solution: SyncSolution | null } | null>(
    null
  )

  useEffect(() => writeStored('syncRole', role), [role])
  useEffect(() => writeStored('syncCode', code), [code])
  useEffect(() => writeStored('syncServer', server), [server])
  useEffect(() => writeStored('syncCallsign', callsign), [callsign])
  useEffect(() => writeStored('syncEnabled', String(enabled)), [enabled])

  // The invitation link worked: remove the code from the address bar
  useEffect(() => {
    if (!invite) return
    try {
      const url = new URL(window.location.href)
      url.search = ''
      window.history.replaceState(null, '', url.toString())
    } catch {
      // It did not work: the code stays in the address, which does no harm.
    }
  }, [invite])

  const publish = useCallback(
    async (message: SyncMessage, retain = false): Promise<boolean> => {
      const connection = connectionRef.current
      if (!connection || !connection.client.connected) return false
      const packet = await encryptMessage(connection.room.key, message)
      const channel =
        message.kind === 'solution'
          ? 'state'
          : message.kind === 'marker'
            ? `markers/${message.marker.id}`
            : 'events'
      connection.client.publish(
        `${connection.room.topic}/${channel}`,
        packetToText(packet),
        { qos: channel === 'events' ? 0 : 1, retain }
      )
      return true
    },
    []
  )

  const publishSolution = useCallback(
    async (solution: SyncSolution | null) => {
      const sent = await publish(
        { kind: 'solution', from: clientId, sentAt: Date.now(), solution },
        true
      )
      if (sent) setLastSharedAt(Date.now())
    },
    [clientId, publish]
  )

  const publishMarker = useCallback(
    (marker: MapMarker) =>
      publish({ kind: 'marker', from: clientId, sentAt: Date.now(), marker }, true),
    [clientId, publish]
  )

  // Removing a marker: an empty message in its channel erases it on the broker
  const clearMarker = useCallback((id: string) => {
    const connection = connectionRef.current
    if (!connection || !connection.client.connected) return
    connection.client.publish(`${connection.room.topic}/markers/${id}`, '', {
      qos: 1,
      retain: true,
    })
  }, [])

  // Markers placed on this device go to everyone in the room
  useEffect(
    () =>
      onLocalMarkerChange((change) => {
        if (change.type === 'upsert') void publishMarker(change.marker)
        else clearMarker(change.id)
      }),
    [publishMarker, clearMarker]
  )

  const roleRef = useRef(role)
  useEffect(() => {
    roleRef.current = role
  }, [role])

  const sendHello = useCallback(() => {
    void publish({
      kind: 'hello',
      from: clientId,
      sentAt: Date.now(),
      role: roleRef.current,
    })
  }, [clientId, publish])

  // The role changed: tell the others at once
  useEffect(() => {
    if (status === 'online') sendHello()
  }, [role, status, sendHello])

  useEffect(() => {
    if (!ready) return

    let cancelled = false
    let client: MqttClient | null = null
    // Replays of intercepted packets are dropped (each connection has its own guard)
    const guard = new ReplayGuard()

    async function handle(message: SyncMessage) {
      const received = Date.now()
      if (message.kind === 'hello') {
        setPeerMap((map) => ({
          ...map,
          [message.from]: { id: message.from, role: message.role, lastSeen: received },
        }))
        return
      }
      setPeerMap((map) =>
        map[message.from]
          ? { ...map, [message.from]: { ...map[message.from], lastSeen: received } }
          : map
      )
      if (message.kind === 'solution') {
        setRemote({
          solution: message.solution,
          sentAt: message.sentAt,
          receivedAt: received,
        })
      }
      if (message.kind === 'shot') {
        shotHandlers.current.forEach((handler) => handler())
      }
    }

    void (async () => {
      try {
        const [mqtt, room] = await Promise.all([
          import('mqtt'),
          deriveRoom(code),
        ])
        // The mqtt build is CommonJS: in development Vite serves it
        // only as default, in production with named exports.
        const connect = mqtt.connect ?? mqtt.default.connect
        if (cancelled) return
        const url = SYNC_SERVERS.find((item) => item.id === server)!.url
        client = connect(url, {
          clientId: `artcalc_${clientId}`,
          reconnectPeriod: 3000,
          connectTimeout: 10_000,
          clean: true,
        })
        connectionRef.current = { client, room }

        client.on('connect', () => {
          setLink('online')
          client?.subscribe(
            [
              `${room.topic}/state`,
              `${room.topic}/events`,
              `${room.topic}/markers/+`,
            ],
            { qos: 1 }
          )
          sendHello()
          // Own markers placed while offline go to the broker
          ownMarkers().forEach((marker) => void publishMarker(marker))
          // After a drop fire direction repeats the last solution
          if (roleRef.current === 'computer' && sharedRef.current) {
            void publishSolution(sharedRef.current.solution)
          }
        })
        client.on('reconnect', () => setLink('connecting'))
        client.on('offline', () => setLink('offline'))
        client.on('error', () => setLink('error'))
        client.on('message', (topic, payload) => {
          const markerPrefix = `${room.topic}/markers/`
          const markerId = topic.startsWith(markerPrefix)
            ? topic.slice(markerPrefix.length)
            : null
          if (markerId !== null && payload.length === 0) {
            applyRemoteMarker({ type: 'remove', id: markerId })
            return
          }
          void decryptMessage(room.key, textToPacket(payload.toString())).then(
            (message) => {
              if (cancelled || !message) return
              if (message.kind === 'marker') {
                if (message.marker.id === markerId) {
                  applyRemoteMarker({ type: 'upsert', marker: message.marker })
                }
                return
              }
              if (message.from !== clientId && guard.accept(message, Date.now())) {
                void handle(message)
              }
            }
          )
        })
      } catch {
        if (!cancelled) setLink('error')
      }
    })()

    const hello = window.setInterval(sendHello, HELLO_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(hello)
      client?.end(true)
      connectionRef.current = null
      setLink(null)
      setPeerMap({})
      setRemote(null)
    }
  }, [ready, code, server, clientId, sendHello, publishSolution, publishMarker])

  // A clock for "who is online"
  useEffect(() => {
    if (status !== 'online') return
    const interval = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(interval)
  }, [status])

  const peers = Object.values(peerMap).filter(
    (peer) => now - peer.lastSeen < PEER_TIMEOUT_MS
  )

  const shareSolution = useCallback(
    (solution: SyncSolution | null) => {
      const json = JSON.stringify(solution)
      if (sharedRef.current?.json === json) return
      sharedRef.current = { json, solution }
      void publishSolution(solution)
    },
    [publishSolution]
  )

  const sendShot = useCallback(() => {
    void publish({ kind: 'shot', from: clientId, sentAt: Date.now() })
  }, [clientId, publish])

  const onShot = useCallback((handler: () => void) => {
    shotHandlers.current.add(handler)
    return () => {
      shotHandlers.current.delete(handler)
    }
  }, [])

  const api: SyncApi = {
    enabled,
    role,
    code,
    server,
    callsign,
    status,
    active: enabled && status === 'online',
    peers,
    remote,
    lastSharedAt,
    setRole: setRoleState,
    setCode: (value) => setCodeState(formatRoomCode(value)),
    setServer: setServerState,
    setCallsign: (value) => setCallsign(value.slice(0, 24)),
    connect: () => setEnabled(true),
    disconnect: () => setEnabled(false),
    shareSolution,
    sendShot,
    onShot,
  }

  return <SyncContext.Provider value={api}>{children}</SyncContext.Provider>
}
