import { useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ActivityStage } from '../components/ActivityStage'
import { getActivity } from '../activities'
import { SyncStatusBadge } from '../components/SyncStatusBadge'
import { useGym } from '../gym/GymContext'
import { useNow } from '../hooks/useNow'

export function TrainerActivityPage() {
  const now = useNow()
  const navigate = useNavigate()
  const { activityId = '' } = useParams()
  const activity = getActivity(activityId)
  const { startActivity, endActivity, bumpInteraction, screenId } = useGym()

  useEffect(() => {
    if (!activity) return
    startActivity(activity.id)
  }, [activity, startActivity])

  useEffect(() => {
    if (!activity) return
    bumpInteraction()
    const id = window.setInterval(bumpInteraction, 15_000)
    return () => window.clearInterval(id)
  }, [activity, bumpInteraction])

  if (!activity) return <Navigate to="/" replace />

  return (
    <main className="trainer-page trainer-activity">
      <SyncStatusBadge />
      <ActivityStage
        time={now}
        activity={activity}
        variant="trainer"
        screenId={screenId ?? ''}
        onEnd={() => {
          endActivity()
          void navigate('/')
        }}
      />
    </main>
  )
}
