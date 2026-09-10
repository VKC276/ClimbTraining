import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  densitySignalOptions,
  formatPhaseClock,
  idleDensityCircuitSession,
  problemTips,
  restStrategy,
  volumeStrategy,
  workStrategy,
  type DensitySignalId,
} from './model'
import {
  playDensitySignal,
  unlockDensityAudio,
  type DensitySignalPhrase,
} from './signals'

type DensityCircuitPanelProps = {
  variant: 'display' | 'trainer'
}

function DensityFit({
  variant,
  children,
}: {
  variant: 'display' | 'trainer'
  children: ReactNode
}) {
  if (variant !== 'display') return children
  return <FitScale className="density-fit">{children}</FitScale>
}

export function DensityCircuitPanel({ variant }: DensityCircuitPanelProps) {
  const now = useNow(80)
  const { snapshot, updateDensityCircuit, setDensityCircuitSession } = useGym()
  const config = snapshot.settings.densityCircuit
  const session = snapshot.densityCircuitSession
  const running = session.phase === 'work' || session.phase === 'rest'
  const remaining = Math.max(0, Math.ceil((session.phaseEndsAt - now.getTime()) / 1000))
  const armedSignal = useRef(true)
  const handledEnd = useRef('')

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.densityCircuitSession
      if (Date.now() < current.phaseEndsAt) return
      const endKey = `${current.phase}-${current.round}-${current.phaseEndsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      if (current.phase === 'work') {
        void playDensitySignal(
          config.workEndSignal,
          current.round >= config.rounds ? 'klart' : 'vila',
        )
        if (current.round >= config.rounds) {
          setDensityCircuitSession({
            phase: 'done',
            round: current.round,
            phaseEndsAt: 0,
          })
          return
        }
        setDensityCircuitSession({
          phase: 'rest',
          round: current.round,
          phaseEndsAt: Date.now() + config.restMinutes * 60_000,
        })
        return
      }
      if (current.phase === 'rest') {
        void playDensitySignal(config.restEndSignal, 'klättra')
        setDensityCircuitSession({
          phase: 'work',
          round: current.round + 1,
          phaseEndsAt: Date.now() + config.workMinutes * 60_000,
        })
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [
    variant,
    running,
    snapshot.densityCircuitSession,
    config.rounds,
    config.restMinutes,
    config.workMinutes,
    config.workEndSignal,
    config.restEndSignal,
    setDensityCircuitSession,
  ])

  useEffect(() => {
    if (variant !== 'display' || !running) return
    if (remaining > 1) {
      armedSignal.current = true
      return
    }
    if (remaining > 0 || !armedSignal.current) return
    armedSignal.current = false
    if (session.phase === 'work') {
      void playDensitySignal(
        config.workEndSignal,
        session.round >= config.rounds ? 'klart' : 'vila',
      )
      return
    }
    void playDensitySignal(config.restEndSignal, 'klättra')
  }, [
    variant,
    running,
    remaining,
    session.phase,
    session.round,
    config.workEndSignal,
    config.restEndSignal,
    config.rounds,
  ])

  const startGame = () => {
    void unlockDensityAudio()
    setDensityCircuitSession({
      phase: 'work',
      round: 1,
      phaseEndsAt: Date.now() + config.workMinutes * 60_000,
    })
  }

  const stopGame = () => setDensityCircuitSession({ ...idleDensityCircuitSession })

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

  return (
    <div className={`density density-${variant} density-${session.phase}`}>
      {variant === 'trainer' && !running ? (
        <form className="density-settings" onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            <span>Arbetsintervall (minuter)</span>
            <input
              type="number"
              min={1}
              max={30}
              step={1}
              value={config.workMinutes}
              onChange={(event) =>
                updateDensityCircuit({ workMinutes: Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Vila (minuter)</span>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={config.restMinutes}
              onChange={(event) =>
                updateDensityCircuit({ restMinutes: Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Antal varv</span>
            <input
              type="number"
              min={1}
              max={20}
              step={1}
              value={config.rounds}
              onChange={(event) =>
                updateDensityCircuit({ rounds: Number(event.target.value) })
              }
            />
          </label>
          <div className="field">
            <span>Signal när klättring tar slut</span>
            <div className="density-signal-row">
              <select
                value={config.workEndSignal}
                onChange={(event) =>
                  updateDensityCircuit({
                    workEndSignal: event.target.value as DensitySignalId,
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
                onClick={(event) => previewSignal(event, 'vila')}
                disabled={config.workEndSignal === 'off'}
              >
                Lyssna
              </button>
            </div>
          </div>
          <div className="field">
            <span>Signal när vila tar slut</span>
            <div className="density-signal-row">
              <select
                value={config.restEndSignal}
                onChange={(event) =>
                  updateDensityCircuit({
                    restEndSignal: event.target.value as DensitySignalId,
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
                onClick={(event) => previewSignal(event, 'klättra')}
                disabled={config.restEndSignal === 'off'}
              >
                Lyssna
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className="density-stage">
        {session.phase === 'idle' ? (
          <DensityFit variant={variant}>
            <div className="density-copy">
              <p>
                {config.workMinutes} min klättra · {config.restMinutes} min vila ·{' '}
                {config.rounds} varv
              </p>
              <p>{workStrategy}</p>
              <p>{restStrategy}</p>
              <p>{volumeStrategy(config.rounds)}</p>
              {variant === 'trainer' ? (
                <ul className="density-tips">
                  {problemTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </DensityFit>
        ) : null}

        {session.phase === 'work' ? (
          <DensityFit variant={variant}>
            <div className="density-live">
              <p className="density-kicker">
                Arbetsintervall · varv {session.round} / {config.rounds}
              </p>
              <p className="density-label">Klättra</p>
              <p className="density-clock">{formatPhaseClock(remaining)}</p>
              <p className="density-cue">{workStrategy}</p>
            </div>
          </DensityFit>
        ) : null}

        {session.phase === 'rest' ? (
          <DensityFit variant={variant}>
            <div className="density-live">
              <p className="density-kicker">
                Vila · varv {session.round} / {config.rounds}
              </p>
              <p className="density-label">Andas</p>
              <p className="density-clock">{formatPhaseClock(remaining)}</p>
              <p className="density-cue">{restStrategy}</p>
            </div>
          </DensityFit>
        ) : null}

        {session.phase === 'done' ? (
          <DensityFit variant={variant}>
            <div className="density-copy">
              <p className="density-label">Klart</p>
              <p>Bra jobbat. Skaka ur och fyll på med vätska.</p>
            </div>
          </DensityFit>
        ) : null}
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          {running ? (
            <button className="button" type="button" onClick={stopGame}>
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
