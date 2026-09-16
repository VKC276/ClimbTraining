import { useEffect, useRef, type MouseEvent } from 'react'
import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  playDensitySignal,
  unlockDensityAudio,
} from '../densityCircuit/signals'
import {
  densitySignalOptions,
  finishOrLoop,
  formatTimerClock,
  idleTimerSession,
  pauseTimer,
  remainingSeconds,
  resumeTimer,
  startTimer,
  timerDurationMs,
  timerIntro,
  timerPresets,
  type DensitySignalId,
} from './model'

type TimerPanelProps = {
  variant: 'display' | 'trainer'
}

export function TimerPanel({ variant }: TimerPanelProps) {
  const now = useNow(80)
  const { snapshot, updateTimer, setTimerSession } = useGym()
  const config = snapshot.settings.timer
  const session = snapshot.timerSession
  const running = session.phase === 'running'
  const paused = session.phase === 'paused'
  const remaining = remainingSeconds(config, session, now.getTime())
  const warning = running && remaining <= 10
  const handledEnd = useRef('')
  const armedSignal = useRef(true)

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.timerSession
      if (Date.now() < current.phaseEndsAt) return
      const endKey = `${current.phaseEndsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      void playDensitySignal(config.doneSignal, 'vila')
      setTimerSession(finishOrLoop(config))
    }, 50)
    return () => window.clearInterval(id)
  }, [
    variant,
    running,
    snapshot.timerSession,
    config,
    setTimerSession,
  ])

  useEffect(() => {
    if (variant !== 'display' || !running) return
    if (remaining > 1) {
      armedSignal.current = true
      return
    }
    if (remaining > 0 || !armedSignal.current) return
    armedSignal.current = false
    void playDensitySignal(config.doneSignal, 'vila')
  }, [variant, running, remaining, config.doneSignal])

  const startGame = () => {
    void unlockDensityAudio()
    setTimerSession(startTimer(config))
  }

  const previewSignal = (event: MouseEvent<HTMLButtonElement>) => {
    const select = event.currentTarget
      .closest('.density-signal-row')
      ?.querySelector('select')
    const id = (select?.value ?? 'bell') as DensitySignalId
    void unlockDensityAudio().then(() => playDensitySignal(id, 'vila'))
  }

  const clock = formatTimerClock(remaining)
  const live = (
    <div className="timer-live">
      <p className="timer-kicker">
        {session.phase === 'paused'
          ? 'Pausad'
          : session.phase === 'done'
            ? 'Klart'
            : session.phase === 'running'
              ? 'Nedräkning'
              : 'Redo'}
      </p>
      <p className="timer-clock">{clock}</p>
      {session.phase === 'running' || session.phase === 'paused' ? (
        <p className="timer-detail">
          {formatTimerClock(timerDurationMs(config) / 1000)} totalt
        </p>
      ) : session.phase === 'done' ? (
        <p className="timer-detail">Tiden är slut</p>
      ) : variant === 'display' ? (
        <p className="timer-detail">Väntar på start</p>
      ) : null}
    </div>
  )

  return (
    <div
      className={`timer timer-${variant} timer-${session.phase}${warning ? ' timer-warn' : ''}`}
    >
      {variant === 'trainer' && !running && !paused ? (
        <form className="timer-settings" onSubmit={(event) => event.preventDefault()}>
          <p className="timer-hint">{timerIntro}</p>
          <div className="timer-presets">
            {timerPresets.map((preset) => {
              const on =
                config.minutes === preset.minutes && config.seconds === preset.seconds
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={on ? 'timer-preset on' : 'timer-preset'}
                  onClick={() =>
                    updateTimer({ minutes: preset.minutes, seconds: preset.seconds })
                  }
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <div className="timer-numbers">
            <label className="field">
              <span>Minuter</span>
              <input
                type="number"
                min={0}
                max={99}
                value={config.minutes}
                onChange={(event) =>
                  updateTimer({ minutes: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Sekunder</span>
              <input
                type="number"
                min={0}
                max={59}
                value={config.seconds}
                onChange={(event) =>
                  updateTimer({ seconds: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className={config.loop ? 'choice selected' : 'choice'}>
            <input
              type="checkbox"
              checked={config.loop}
              onChange={(event) => updateTimer({ loop: event.target.checked })}
            />
            <span>
              <strong>Starta om när tiden tar slut</strong>
              <span className="choice-hint">För intervaller som ska köras om och om igen.</span>
            </span>
          </label>
          <div className="field">
            <span>Signal när tiden tar slut</span>
            <div className="density-signal-row">
              <select
                value={config.doneSignal}
                onChange={(event) =>
                  updateTimer({ doneSignal: event.target.value as DensitySignalId })
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
                onClick={previewSignal}
                disabled={config.doneSignal === 'off'}
              >
                Lyssna
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="timer-stage">
        {variant === 'display' ? (
          <FitScale className="density-fit">{live}</FitScale>
        ) : (
          live
        )}
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          {running ? (
            <>
              <button
                className="button"
                type="button"
                onClick={() => setTimerSession(pauseTimer(session))}
              >
                Pausa
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setTimerSession({ ...idleTimerSession })}
              >
                Nollställ
              </button>
            </>
          ) : paused ? (
            <>
              <button
                className="button"
                type="button"
                onClick={() => setTimerSession(resumeTimer(session))}
              >
                Fortsätt
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => setTimerSession({ ...idleTimerSession })}
              >
                Nollställ
              </button>
            </>
          ) : (
            <button className="button" type="button" onClick={startGame}>
              {session.phase === 'done' ? 'Kör igen' : 'Starta'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
