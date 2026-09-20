import { useCallback, useEffect } from 'react'
import { ActivityStage } from '../components/ActivityStage'
import { IdleScreen } from '../components/IdleScreen'
import { getActivity } from '../activities'
import { unlockDensityAudio } from '../activities/densityCircuit/signals'
import { OfflineWifiBadge } from '../components/OfflineWifiBadge'
import { useGym } from '../gym/GymContext'
import { useIdleTimeout } from '../hooks/useIdleTimeout'
import { useNow } from '../hooks/useNow'
import { usePiDisplayControl } from '../hooks/usePiDisplayControl'
import { usePiInternet } from '../hooks/usePiInternet'
import { useWakeLock } from '../hooks/useWakeLock'

export function DisplayPage() {
  const now = useNow()
  const { snapshot, bumpInteraction, screenId, updateSettings } = useGym()
  const activity = getActivity(snapshot.activityId)
  const hardware = snapshot.settings.displayHardware
  const { idleLogoSize, idleClockSize, idleScreenIdSize, clockStyle } = snapshot.settings
  const internet = usePiInternet()

  useIdleTimeout()
  useWakeLock(true)
  useEffect(() => {
    document.documentElement.classList.add('display-no-cursor')
    return () => document.documentElement.classList.remove('display-no-cursor')
  }, [])
  useEffect(() => {
    void unlockDensityAudio()
    const id = window.setInterval(() => {
      void unlockDensityAudio()
    }, 20_000)
    return () => window.clearInterval(id)
  }, [])
  usePiDisplayControl(
    hardware,
    useCallback(
      (hdmiOn) => {
        updateSettings({
          displayHardware: { ...hardware, hdmiOn },
        })
      },
      [hardware, updateSettings],
    ),
  )

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
            activity.id === 'timer' ||
            activity.id === 'dubbelregeln'
            ? 'display-page display-page-fill'
            : 'display-page'
          : 'display-page display-page-idle'
      }
    >
      {internet ? null : <OfflineWifiBadge />}
      {activity ? (
        <ActivityStage
          time={now}
          activity={activity}
          variant="display"
          screenId={screenId ?? ''}
        />
      ) : (
        <IdleScreen
          time={now}
          clockStyle={clockStyle}
          screenId={screenId ?? ''}
          logoSize={idleLogoSize}
          clockSize={idleClockSize}
          screenIdSize={idleScreenIdSize}
        />
      )}
    </main>
  )
}
