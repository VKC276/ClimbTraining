import { useEffect } from 'react'
import { useGym } from '../gym/GymContext'

export function useIdleTimeout() {
  const { snapshot, endActivity } = useGym()

  useEffect(() => {
    if (!snapshot.activityId) return

    const timeoutMs = snapshot.settings.idleTimeoutMinutes * 60_000
    const tick = () => {
      if (Date.now() - snapshot.lastInteractionAt >= timeoutMs) {
        endActivity()
      }
    }

    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [
    snapshot.activityId,
    snapshot.lastInteractionAt,
    snapshot.settings.idleTimeoutMinutes,
    endActivity,
  ])
}
