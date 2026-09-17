import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent } from 'react'
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
  emomExercise,
  emomIntro,
  formatEmomClock,
  idleEmomSession,
  isRestExercise,
  moveEmomExercise,
  normalizeExerciseText,
  type DensitySignalId,
} from './model'

type EmomPanelProps = {
  variant: 'display' | 'trainer'
}

export function EmomPanel({ variant }: EmomPanelProps) {
  const now = useNow(80)
  const { snapshot, updateEmom, setEmomSession } = useGym()
  const config = snapshot.settings.emom
  const session = snapshot.emomSession
  const [draft, setDraft] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const exercisesRef = useRef(config.exercises)
  const dragFrom = useRef<number | null>(null)
  exercisesRef.current = config.exercises
  const running = session.phase === 'running'
  const remaining = Math.max(0, Math.ceil((session.phaseEndsAt - now.getTime()) / 1000))
  const exercise = emomExercise(config.exercises, session.round)
  const rest = isRestExercise(exercise)
  const warning = running && remaining > 0 && remaining <= config.warnSeconds
  const startedAgo = config.intervalSeconds * 1000 - (session.phaseEndsAt - now.getTime())
  const goFlash = running && startedAgo >= 0 && startedAgo < 1100
  const handledEnd = useRef('')
  const warnedFor = useRef('')
  const lastRound = useRef(0)

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.emomSession
      if (Date.now() < current.phaseEndsAt) return
      const endKey = `${current.round}-${current.phaseEndsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      if (current.round >= config.totalRounds) {
        setEmomSession({
          phase: 'done',
          round: current.round,
          phaseEndsAt: 0,
        })
        return
      }
      void playDensitySignal(config.goSignal, 'go')
      setEmomSession({
        phase: 'running',
        round: current.round + 1,
        phaseEndsAt: Date.now() + config.intervalSeconds * 1000,
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [
    variant,
    running,
    snapshot.emomSession,
    config.totalRounds,
    config.intervalSeconds,
    config.goSignal,
    setEmomSession,
  ])

  useEffect(() => {
    if (!running) return
    const key = `${session.round}-${session.phaseEndsAt}`
    if (remaining > config.warnSeconds) {
      if (warnedFor.current === key) warnedFor.current = ''
      return
    }
    if (remaining <= 0 || warnedFor.current === key) return
    warnedFor.current = key
    void playDensitySignal(config.warnSignal, 'varning')
  }, [
    running,
    remaining,
    session.round,
    session.phaseEndsAt,
    config.warnSeconds,
    config.warnSignal,
  ])

  useEffect(() => {
    if (!running) {
      lastRound.current = 0
      return
    }
    if (variant !== 'display') return
    if (session.round === lastRound.current) return
    lastRound.current = session.round
    if (session.round < 1) return
    void playDensitySignal(config.goSignal, 'go')
  }, [variant, running, session.round, config.goSignal])

  const startGame = () => {
    void unlockDensityAudio()
    void playDensitySignal(config.goSignal, 'go')
    setEmomSession({
      phase: 'running',
      round: 1,
      phaseEndsAt: Date.now() + config.intervalSeconds * 1000,
    })
  }

  const stopGame = () => setEmomSession({ ...idleEmomSession })

  const addExercise = (event: FormEvent) => {
    event.preventDefault()
    const text = normalizeExerciseText(draft)
    if (!text) return
    updateEmom({ exercises: [...config.exercises, text] })
    setDraft('')
  }

  const removeExercise = (index: number) => {
    updateEmom({
      exercises: config.exercises.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  const onDragPointerDown = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragFrom.current = index
    setDragging(index)
  }

  const onDragPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const from = dragFrom.current
    if (from === null) return
    const hit = document.elementFromPoint(event.clientX, event.clientY)
    const row = hit?.closest('[data-emom-index]')
    if (!row) return
    const to = Number(row.getAttribute('data-emom-index'))
    if (!Number.isInteger(to) || to === from) return
    updateEmom({ exercises: moveEmomExercise(exercisesRef.current, from, to) })
    dragFrom.current = to
    setDragging(to)
  }

  const onDragPointerUp = () => {
    dragFrom.current = null
    setDragging(null)
  }

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

  const live = (
    <div className="emom-live">
      <p className="emom-kicker">
        Runda {session.round}/{config.totalRounds}
      </p>
      <p className="emom-exercise">{exercise}</p>
      <p className="emom-clock">{formatEmomClock(remaining)}</p>
    </div>
  )

  return (
    <div
      className={`emom emom-${variant} emom-${session.phase}${warning ? ' emom-warn' : ''}${goFlash ? ' emom-go' : ''}${rest ? ' emom-rest' : ''}`}
    >
      {variant === 'trainer' && !running ? (
        <div className="emom-settings">
          <p className="emom-hint">{emomIntro}</p>
          <form className="tech-focus-editor" onSubmit={addExercise}>
            <ul className="tech-focus-list">
              {config.exercises.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className={dragging === index ? 'emom-item dragging' : 'emom-item'}
                  data-emom-index={index}
                >
                  <button
                    className="emom-drag"
                    type="button"
                    aria-label="Ändra ordning"
                    onPointerDown={(event) => onDragPointerDown(index, event)}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    onPointerCancel={onDragPointerUp}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M8 7h2v2H8V7Zm6 0h2v2h-2V7ZM8 11h2v2H8v-2Zm6 0h2v2h-2v-2ZM8 15h2v2H8v-2Zm6 0h2v2h-2v-2Z"
                      />
                    </svg>
                  </button>
                  <span>{item}</span>
                  <button
                    className="button-ghost tech-focus-remove"
                    type="button"
                    onClick={() => removeExercise(index)}
                    disabled={config.exercises.length <= 1}
                  >
                    Ta bort
                  </button>
                </li>
              ))}
            </ul>
            <div className="tech-focus-add">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={90}
                placeholder="Ny övning, t.ex. 8 dips"
                aria-label="Ny övning"
              />
              <button className="button" type="submit" disabled={!normalizeExerciseText(draft)}>
                Lägg till
              </button>
            </div>
          </form>
          <form className="density-settings" onSubmit={(event) => event.preventDefault()}>
            <label className="field">
              <span>Intervall (sekunder)</span>
              <input
                type="number"
                min={15}
                max={180}
                step={1}
                value={config.intervalSeconds}
                onChange={(event) =>
                  updateEmom({ intervalSeconds: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Antal rundor (minuter om 60 s)</span>
              <input
                type="number"
                min={1}
                max={120}
                step={1}
                value={config.totalRounds}
                onChange={(event) =>
                  updateEmom({ totalRounds: Number(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Varning (sekunder kvar)</span>
              <input
                type="number"
                min={3}
                max={30}
                step={1}
                value={config.warnSeconds}
                onChange={(event) =>
                  updateEmom({ warnSeconds: Number(event.target.value) })
                }
              />
            </label>
            <div className="field">
              <span>Varningssignal</span>
              <div className="density-signal-row">
                <select
                  value={config.warnSignal}
                  onChange={(event) =>
                    updateEmom({ warnSignal: event.target.value as DensitySignalId })
                  }
                >
                  {densitySignalOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="button-ghost"
                  type="button"
                  onClick={(event) => previewSignal(event, 'varning')}
                  disabled={config.warnSignal === 'off'}
                >
                  Lyssna
                </button>
              </div>
            </div>
            <div className="field">
              <span>GO-signal vid ny minut</span>
              <div className="density-signal-row">
                <select
                  value={config.goSignal}
                  onChange={(event) =>
                    updateEmom({ goSignal: event.target.value as DensitySignalId })
                  }
                >
                  {densitySignalOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className="button-ghost"
                  type="button"
                  onClick={(event) => previewSignal(event, 'go')}
                  disabled={config.goSignal === 'off'}
                >
                  Lyssna
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      <div className="emom-stage">
        {session.phase === 'running' ? (
          variant === 'display' ? (
            <FitScale className="density-fit">{live}</FitScale>
          ) : (
            <div className="emom-live">{live}</div>
          )
        ) : session.phase === 'done' ? (
          <p className="emom-exercise">Klart</p>
        ) : variant === 'trainer' ? (
          <p className="emom-wait">
            {config.totalRounds} rundor · {config.intervalSeconds} s ·{' '}
            {config.exercises.length} övningar i loop
          </p>
        ) : (
          <p className="emom-wait">Väntar på start.</p>
        )}
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
