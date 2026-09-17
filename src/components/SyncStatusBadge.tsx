import { useGym } from '../gym/GymContext'

const labels = {
  connected: 'Synk ansluten',
  connecting: 'Synkar',
  offline: 'Synk offline',
} as const

function WifiIcon({ slashed }: { slashed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 18.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm-4.95-4.05a7 7 0 0 1 9.9 0l-1.5 1.5a4.9 4.9 0 0 0-6.9 0Zm-2.9-2.9a11.1 11.1 0 0 1 15.7 0l-1.5 1.5a9 9 0 0 0-12.7 0Z"
      />
      {slashed ? (
        <path
          fill="currentColor"
          d="M4.2 5.6 18.4 19.8l-1.4 1.4L2.8 7Z"
        />
      ) : null}
    </svg>
  )
}

export function SyncStatusBadge({ className = '' }: { className?: string }) {
  const { syncStatus } = useGym()
  return (
    <p
      className={`sync-badge sync-${syncStatus}${className ? ` ${className}` : ''}`}
      role="status"
      aria-label={labels[syncStatus]}
      title={labels[syncStatus]}
    >
      <WifiIcon slashed={syncStatus === 'offline'} />
    </p>
  )
}
