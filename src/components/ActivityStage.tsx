import { Link } from 'react-router-dom'
import { CatchHoldPanel } from '../activities/catchHold/CatchHoldPanel'
import { DensityCircuitPanel } from '../activities/densityCircuit/DensityCircuitPanel'
import { StationTrainingPanel } from '../activities/stationTraining/StationTrainingPanel'
import { TechniqueFocusPanel } from '../activities/techniqueFocus/TechniqueFocusPanel'
import { EmomPanel } from '../activities/emom/EmomPanel'
import { ChoosePathPanel } from '../activities/choosePath/ChoosePathPanel'
import { FingerboardPanel } from '../activities/fingerboard/FingerboardPanel'
import { TimerPanel } from '../activities/timer/TimerPanel'
import { DigitalClock } from './DigitalClock'
import type { Activity } from '../types'

type ActivityStageProps = {
  time: Date
  activity: Activity
  variant: 'display' | 'trainer'
  screenId?: string
  onEnd?: () => void
}

function ActivityBody({
  activity,
  variant,
}: {
  activity: Activity
  variant: 'display' | 'trainer'
}) {
  if (activity.id === 'catch-hold') return <CatchHoldPanel variant={variant} />
  if (activity.id === 'density-circuit') {
    return <DensityCircuitPanel variant={variant} />
  }
  if (activity.id === 'station-training') {
    return <StationTrainingPanel variant={variant} />
  }
  if (activity.id === 'technique-focus') {
    return <TechniqueFocusPanel variant={variant} />
  }
  if (activity.id === 'emom') {
    return <EmomPanel variant={variant} />
  }
  if (activity.id === 'choose-path') {
    return <ChoosePathPanel variant={variant} />
  }
  if (activity.id === 'fingerboard') {
    return <FingerboardPanel variant={variant} />
  }
  if (activity.id === 'timer') {
    return <TimerPanel variant={variant} />
  }
  return (
    <>
      <p className="activity-lead">{activity.description}</p>
      <p className="activity-note">
        Den här vyn är redo att fyllas med passets egna verktyg. Tills vidare
        visas namnet på momentet på storskärmen tillsammans med klockan.
      </p>
    </>
  )
}

export function ActivityStage({
  time,
  activity,
  variant,
  screenId,
  onEnd,
}: ActivityStageProps) {
  const fill =
    activity.id === 'catch-hold' ||
    activity.id === 'density-circuit' ||
    activity.id === 'station-training' ||
    activity.id === 'technique-focus' ||
    activity.id === 'emom' ||
    activity.id === 'choose-path' ||
    activity.id === 'fingerboard' ||
    activity.id === 'timer'

  return (
    <div
      className={`activity-stage activity-stage-${variant}${fill ? ' activity-stage-fill' : ''}`}
    >
      <header className="activity-top">
        <div className="activity-top-title">
          <p className="eyebrow">Träningsmoment</p>
          <h1>{activity.title}</h1>
        </div>
        {screenId ? <p className="activity-screen-id">{screenId}</p> : <span />}
        <DigitalClock time={time} size="overlay" />
      </header>

      <section className={fill ? 'activity-body activity-body-fill' : 'activity-body'}>
        <ActivityBody activity={activity} variant={variant} />
      </section>

      {variant === 'trainer' && onEnd ? (
        <footer className="activity-actions">
          <Link className="button button-ghost" to="/">
            Tillbaka till menyn
          </Link>
          <button className="button" type="button" onClick={onEnd}>
            Avsluta
          </button>
        </footer>
      ) : null}
    </div>
  )
}
