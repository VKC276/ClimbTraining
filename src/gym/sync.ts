export type SyncStatus = 'connecting' | 'connected' | 'offline'

export const defaultSyncUrl = 'wss://vvk-gym-sync.muddy-rice-38d4.workers.dev'

export function syncSocketUrl(query: Record<string, string>) {
  const base = (import.meta.env.VITE_SYNC_WS as string | undefined)?.trim() || defaultSyncUrl
  const url = new URL(base)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}
