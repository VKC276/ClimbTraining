import { useEffect, useRef } from 'react'
import { hasLiveSession } from '../gym/liveSession'
import { useGym } from '../gym/GymContext'

export function useIdleTimeout() {
  const { snapshot, endActivity, bumpInteraction, syncReady } = useGym()
  const snapshotRef = useRef(snapshot)
  const wasLive = useRef(false)
  const ending = useRef(false)
  snapshotRef.current = snapshot

  useEffect(() => {
    if (!syncReady) return

    const tick = () => {
      const current = snapshotRef.current
      if (!current.activityId) {
        wasLive.current = false
        ending.current = false
        return
      }
      if (hasLiveSession(current)) {
        wasLive.current = true
        ending.current = false
        return
      }
      if (wasLive.current) {
        wasLive.current = false
        bumpInteraction()
        return
      }
      const timeoutMs = current.settings.idleTimeoutMinutes * 60_000
      if (Date.now() - current.lastInteractionAt < timeoutMs) return
      if (ending.current) return
      ending.current = true
      endActivity()
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [syncReady, endActivity, bumpInteraction])
}
