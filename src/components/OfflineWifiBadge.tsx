export function OfflineWifiBadge() {
  return (
    <p
      className="offline-wifi-badge"
      role="status"
      aria-label="Ingen internetanslutning"
      title="Ingen internetanslutning"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 18.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm-4.95-4.05a7 7 0 0 1 9.9 0l-1.5 1.5a4.9 4.9 0 0 0-6.9 0Zm-2.9-2.9a11.1 11.1 0 0 1 15.7 0l-1.5 1.5a9 9 0 0 0-12.7 0Z"
        />
        <path fill="currentColor" d="M4.2 5.6 18.4 19.8l-1.4 1.4L2.8 7Z" />
      </svg>
    </p>
  )
}
