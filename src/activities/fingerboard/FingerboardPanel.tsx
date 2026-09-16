import { useEffect, useRef } from 'react'
import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  playDensitySignal,
  unlockDensityAudio,
} from '../densityCircuit/signals'
import {
  advanceFingerboard,
  densitySignalOptions,
  detailFor,
  fingerboardIntro,
  formatFingerClock,
  headlineFor,
  idleFingerboardSession,
  phaseDurationMs,
  startFingerboardSession,
  summaryFor,
  type DensitySignalId,
} from './model'

type FingerboardPanelProps = {
  variant: 'display' | 'trainer'
}

export function FingerboardPanel({ variant }: FingerboardPanelProps) {
  const now = useNow(80)
  const { snapshot, updateFingerboard, setFingerboardSession } = useGym()
  const config = snapshot.settings.fingerboard
  const session = snapshot.fingerboardSession
  const running = session.phase === 'running'
  const remaining = Math.min(
    Math.round(phaseDurationMs(config, session) / 1000),
    Math.max(0, Math.ceil((session.phaseEndsAt - now.getTime()) / 1000)),
  )
  const hang = session.kind === 'hang'
  const handledEnd = useRef('')
  const armedSignal = useRef(true)

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.fingerboardSession
      if (Date.now() < current.phaseEndsAt) return
      const endKey = `${current.set}-${current.rep}-${current.kind}-${current.phaseEndsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      const next = advanceFingerboard(config, current)
      if (next.phase === 'running') {
        void playDensitySignal(
          next.kind === 'hang' ? config.hangSignal : config.restSignal,
          next.kind === 'hang' ? 'go' : 'vila',
        )
      }
      setFingerboardSession(next)
    }, 50)
    return () => window.clearInterval(id)
  }, [
    variant,
    running,
    snapshot.fingerboardSession,
    config,
    setFingerboardSession,
  ])

  useEffect(() => {
    if (variant !== 'display' || !running) return
    if (remaining > 1) {
      armedSignal.current = true
      return
    }
    if (remaining > 0 || !armedSignal.current) return
    armedSignal.current = false
    const nextHang = session.kind !== 'hang'
    void playDensitySignal(
      nextHang ? config.hangSignal : config.restSignal,
      nextHang ? 'go' : 'vila',
    )
  }, [
    variant,
    running,
    remaining,
    session.kind,
    config.hangSignal,
    config.restSignal,
  ])

  const startGame = () => {
    void unlockDensityAudio()
    void playDensitySignal(config.hangSignal, 'go')
    setFingerboardSession(startFingerboardSession(config))
  }

  const live = (
    <div className="finger-live">
      <p className="finger-kicker">
        Rep {session.rep} / {config.reps} · Set {session.set} / {config.sets}
      </p>
      <p className="finger-headline">{headlineFor(config, session)}</p>
      <p className="finger-clock">{formatFingerClock(remaining)}</p>
      <p className="finger-detail">{detailFor(config, session)}</p>
    </div>
  )

  return (
    <div
      className={`finger finger-${variant} finger-${session.phase}${hang && running ? ' finger-hang' : ''}${running && !hang ? ' finger-rest' : ''}`}
    >
      {variant === 'trainer' && !running ? (
        <form className="finger-settings" onSubmit={(event) => event.preventDefault()}>
          <p className="finger-hint">{fingerboardIntro}</p>
          <div className="finger-numbers">
            <label className="field">
              <span>Häng (s)</span>
              <input
                type="number"
                min={3}
                max={20}
                value={config.hangSeconds}
                onChange={(event) =>
                  updateFingerboard({ hangSeconds: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Vila mellan reps (s)</span>
              <input
                type="number"
                min={1}
                max={15}
                value={config.shortRestSeconds}
                onChange={(event) =>
                  updateFingerboard({ shortRestSeconds: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Reps</span>
              <input
                type="number"
                min={2}
                max={12}
                value={config.reps}
                onChange={(event) =>
                  updateFingerboard({ reps: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Vila mellan set (s)</span>
              <input
                type="number"
                min={30}
                max={600}
                step={15}
                value={config.setRestSeconds}
                onChange={(event) =>
                  updateFingerboard({ setRestSeconds: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Set</span>
              <input
                type="number"
                min={1}
                max={8}
                value={config.sets}
                onChange={(event) =>
                  updateFingerboard({ sets: Number(event.target.value) })
                }
              />
            </label>
          </div>

          <div className="field">
            <span>Signal vid häng</span>
            <select
              value={config.hangSignal}
              onChange={(event) =>
                updateFingerboard({ hangSignal: event.target.value as DensitySignalId })
              }
            >
              {densitySignalOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>Signal vid vila</span>
            <select
              value={config.restSignal}
              onChange={(event) =>
                updateFingerboard({ restSignal: event.target.value as DensitySignalId })
              }
            >
              {densitySignalOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </form>
      ) : null}

      <div className="finger-stage">
        {session.phase === 'running' ? (
          variant === 'display' ? (
            <FitScale className="density-fit">{live}</FitScale>
          ) : (
            live
          )
        ) : session.phase === 'done' ? (
          <p className="finger-headline">Klart</p>
        ) : variant === 'display' ? (
          <p className="finger-wait">Väntar på start vid fingerbrädan.</p>
        ) : (
          <p className="finger-wait">{summaryFor(config)}</p>
        )}
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          {running ? (
            <button
              className="button"
              type="button"
              onClick={() => setFingerboardSession({ ...idleFingerboardSession })}
            >
              Stoppa
            </button>
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
