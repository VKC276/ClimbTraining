import { useEffect } from 'react'
import { ActivityStage } from '../components/ActivityStage'
import { IdleScreen } from '../components/IdleScreen'
import { getActivity } from '../activities'
import { unlockDensityAudio } from '../activities/densityCircuit/signals'
import { useGym } from '../gym/GymContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useNow } from '../hooks/useNow'
import { useWakeLock } from '../hooks/useWakeLock'

export function DisplayPage() {
  const now = useNow()
  const { snapshot, bumpInteraction, syncStatus, screenId } = useGym()
  const activity = getActivity(snapshot.activityId)

  useIdleTimeout()
  useWakeLock(true)

  useEffect(() => {
    const onInteract = () => {
      bumpInteraction()
      void unlockDensityAudio()
    }
    window.addEventListener('pointerdown', onInteract)
    window.addEventListener('keydown', onInteract)
    return () => {
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('keydown', onInteract)
    }
  }, [bumpInteraction])

  return (
    <main
      className={
        activity
          ? activity.id === 'catch-hold' ||
            activity.id === 'density-circuit' ||
            activity.id === 'station-training' ||
            activity.id === 'technique-focus' ||
            activity.id === 'emom' ||
            activity.id === 'choose-path' ||
            activity.id === 'fingerboard' ||
            activity.id === 'timer'
            ? 'display-page display-page-fill'
            : 'display-page'
          : 'display-page display-page-idle'
      }
    >
      {syncStatus !== 'connected' ? (
        <p className={`display-sync-badge sync-${syncStatus}`}>
          {syncStatus === 'connecting' ? 'Synkar…' : 'Synk offline'}
        </p>
      ) : null}
      {activity ? (
        <ActivityStage time={now} activity={activity} variant="display" />
      ) : (
        <IdleScreen
          time={now}
          clockStyle={snapshot.settings.clockStyle}
          screenId={screenId ?? ''}
        />
      )}
    </main>
  )
}
