import { t } from '../i18n'
import { createContext, useContext } from 'react'

import type { SyncRole, SyncServerId, SyncSolution } from './sync'

export type SyncStatus = 'off' | 'connecting' | 'online' | 'offline' | 'error'

export interface SyncPeer {
  id: string
  role: SyncRole
  lastSeen: number
}

export interface RemoteSolution {
  solution: SyncSolution | null
  // When fire direction sent it and when it arrived here, ms
  sentAt: number
  receivedAt: number
}

export interface SyncApi {
  enabled: boolean
  role: SyncRole
  code: string
  server: SyncServerId
  // The call sign: the label of own markers
  callsign: string
  status: SyncStatus
  // The connection is on and the broker is reachable
  active: boolean
  // Other devices in the room that answered recently
  peers: SyncPeer[]
  // The last solution from fire direction (for the gunner)
  remote: RemoteSolution | null
  // When fire direction last sent a solution
  lastSharedAt: number | null
  setRole: (role: SyncRole) => void
  setCode: (code: string) => void
  setServer: (server: SyncServerId) => void
  setCallsign: (callsign: string) => void
  connect: () => void
  disconnect: () => void
  // Fire direction: the current solution (repeats without changes are not sent)
  shareSolution: (solution: SyncSolution | null) => void
  // A shot: the others start a countdown to impact
  sendShot: () => void
  // A shot from another device; returns an unsubscribe function
  onShot: (handler: () => void) => () => void
}

const noop = () => {}

export const SyncContext = createContext<SyncApi>({
  enabled: false,
  role: 'computer',
  code: '',
  server: 'hivemq',
  callsign: '',
  status: 'off',
  active: false,
  peers: [],
  remote: null,
  lastSharedAt: null,
  setRole: noop,
  setCode: noop,
  setServer: noop,
  setCallsign: noop,
  connect: noop,
  disconnect: noop,
  shareSolution: noop,
  sendShot: noop,
  onShot: () => noop,
})

export function useSync(): SyncApi {
  return useContext(SyncContext)
}

export function syncStatusText(status: SyncStatus): string {
  switch (status) {
    case 'off':
      return t('syncContext.off')
    case 'connecting':
      return t('syncContext.connecting')
    case 'online':
      return t('syncContext.online')
    case 'offline':
      return t('syncContext.offline')
    case 'error':
      return t('syncContext.connection-error')
  }
}

export function syncStatusColor(status: SyncStatus): string {
  return status === 'online'
    ? 'bg-ok'
    : status === 'connecting'
      ? 'bg-warn'
      : status === 'off'
        ? 'bg-app-faint'
        : 'bg-danger'
}
