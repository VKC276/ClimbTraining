import { useEffect } from 'react'

export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return

    let cancelled = false
    let sentinel: WakeLockSentinel | undefined

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // Fullscreen/kiosk utan gest kan neka wake lock.
      }
    }

    void request()
    const onVisible = () => {
      if (!cancelled && document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release()
    }
  }, [enabled])
}
