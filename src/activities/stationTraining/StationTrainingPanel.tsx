import { useEffect, useRef, type MouseEvent } from 'react'
import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  playDensitySignal,
  unlockDensityAudio,
  type DensitySignalPhrase,
} from '../densityCircuit/signals'
import {
  densitySignalOptions,
  formatStationClock,
  idleStationTrainingSession,
  stationDurationMs,
  stationTrainingExamples,
  stationTrainingIntro,
  type DensitySignalId,
} from './model'

type StationTrainingPanelProps = {
  variant: 'display' | 'trainer'
}

export function StationTrainingPanel({ variant }: StationTrainingPanelProps) {
  const now = useNow(80)
  const { snapshot, updateStationTraining, setStationTrainingSession } = useGym()
  const config = snapshot.settings.stationTraining
  const session = snapshot.stationTrainingSession
  const running = session.phase === 'running'
  const remaining = Math.max(0, Math.ceil((session.phaseEndsAt - now.getTime()) / 1000))
  const armedSignal = useRef(true)
  const handledEnd = useRef('')

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.stationTrainingSession
      if (Date.now() < current.phaseEndsAt) return
      const endKey = `${current.station}-${current.phaseEndsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      void playDensitySignal(config.switchSignal, 'byt')
      setStationTrainingSession({
        phase: 'running',
        station: current.station + 1,
        phaseEndsAt: Date.now() + stationDurationMs(config),
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [
    variant,
    running,
    snapshot.stationTrainingSession,
    config,
    setStationTrainingSession,
  ])

  useEffect(() => {
    if (variant !== 'display' || !running) return
    if (remaining > 1) {
      armedSignal.current = true
      return
    }
    if (remaining > 0 || !armedSignal.current) return
    armedSignal.current = false
    void playDensitySignal(config.switchSignal, 'byt')
  }, [variant, running, remaining, config.switchSignal])

  const startGame = () => {
    void unlockDensityAudio()
    setStationTrainingSession({
      phase: 'running',
      station: 1,
      phaseEndsAt: Date.now() + stationDurationMs(config),
    })
  }

  const stopGame = () => setStationTrainingSession({ ...idleStationTrainingSession })

  const previewSignal = (
    event: MouseEvent<HTMLButtonElement>,
    phrase: DensitySignalPhrase,
  ) => {
    const select = event.currentTarget
      .closest('.density-signal-row')
      ?.querySelector('select')
    const id = (select?.value ?? 'beep') as DensitySignalId
    void unlockDensityAudio().then(() => playDensitySignal(id, phrase))
  }

  const clock = formatStationClock(remaining)

  return (
    <div className={`stations stations-${variant} stations-${session.phase}`}>
      {variant === 'trainer' && !running ? (
        <form className="density-settings" onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            <span>Stationstid (minuter)</span>
            <input
              type="number"
              min={0}
              max={60}
              step={1}
              value={config.stationMinutes}
              onChange={(event) =>
                updateStationTraining({ stationMinutes: Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Stationstid (sekunder)</span>
            <input
              type="number"
              min={0}
              max={59}
              step={1}
              value={config.stationSeconds}
              onChange={(event) =>
                updateStationTraining({ stationSeconds: Number(event.target.value) })
              }
            />
          </label>
          <div className="field">
            <span>Signal vid byte</span>
            <div className="density-signal-row">
              <select
                value={config.switchSignal}
                onChange={(event) =>
                  updateStationTraining({
                    switchSignal: event.target.value as DensitySignalId,
                  })
                }
              >
                {densitySignalOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} — {option.hint}
                  </option>
                ))}
              </select>
              <button
                className="button-ghost"
                type="button"
                onClick={(event) => previewSignal(event, 'byt')}
                disabled={config.switchSignal === 'off'}
              >
                Lyssna
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="stations-stage">
        {running ? (
          variant === 'display' ? (
            <FitScale className="density-fit">
              <div className="stations-live">
                <p className="stations-prompt">Byt station om</p>
                <p className="stations-clock">{clock}</p>
              </div>
            </FitScale>
          ) : (
            <div className="stations-live">
              <p className="stations-kicker">Station {session.station}</p>
              <p className="stations-prompt">Byt station om</p>
              <p className="stations-clock">{clock}</p>
            </div>
          )
        ) : (
          <div className="stations-copy">
            {variant === 'trainer' ? (
              <>
                <p>{stationTrainingIntro}</p>
                <p>{stationTrainingExamples}</p>
                <p>
                  Stationstid:{' '}
                  {formatStationClock(
                    config.stationMinutes * 60 + config.stationSeconds,
                  )}
                </p>
              </>
            ) : (
              <p>Väntar på start. Gruppen roterar när tiden tar slut.</p>
            )}
          </div>
        )}
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          {running ? (
            <button className="button button-stop" type="button" onClick={stopGame}>
              Stoppa
            </button>
          ) : (
            <button className="button button-start" type="button" onClick={startGame}>
              Starta
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
