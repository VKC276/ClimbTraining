import { useGym } from '../gym/GymContext'

const labels = {
  connected: 'Synk ansluten',
  connecting: 'Synkar…',
  offline: 'Synk offline',
} as const

export function SyncStatusBadge() {
  const { syncStatus } = useGym()
  return (
    <p className={`sync-badge sync-${syncStatus}`} role="status">
      {labels[syncStatus]}
    </p>
  )
}
