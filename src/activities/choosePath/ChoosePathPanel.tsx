import { useEffect, useRef } from 'react'
import { NumberField } from '../../components/NumberField'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  choosePathIntro,
  formatChooseClock,
  idleChoosePathSession,
  lavaProgress,
} from './model'

type ChoosePathPanelProps = {
  variant: 'display' | 'trainer'
}

export function ChoosePathPanel({ variant }: ChoosePathPanelProps) {
  const now = useNow(50)
  const { snapshot, updateChoosePath, setChoosePathSession } = useGym()
  const seconds = snapshot.settings.choosePath.seconds
  const session = snapshot.choosePathSession
  const running = session.phase === 'running'
  const remaining = Math.max(0, Math.ceil((session.endsAt - now.getTime()) / 1000))
  const progress = lavaProgress(session.startedAt, session.endsAt, now.getTime())
  const handledEnd = useRef('')

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.choosePathSession
      if (Date.now() < current.endsAt) return
      const endKey = `${current.endsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      setChoosePathSession({
        ...current,
        phase: 'caught',
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [variant, running, snapshot.choosePathSession, setChoosePathSession])

  const startLava = () => {
    const startedAt = Date.now()
    setChoosePathSession({
      phase: 'running',
      startedAt,
      endsAt: startedAt + seconds * 1000,
    })
  }

  const lavaHeight = `${Math.round(progress * 1000) / 10}%`

  return (
    <div className={`choose choose-${variant} choose-${session.phase}`}>
      {variant === 'trainer' && !running ? (
        <div className="choose-editor">
          <p className="choose-hint">{choosePathIntro}</p>
          <form className="density-settings" onSubmit={(event) => event.preventDefault()}>
            <NumberField
              label="Tid (sekunder)"
              min={10}
              max={300}
              value={seconds}
              onChange={(next) => updateChoosePath({ seconds: next })}
            />
          </form>
        </div>
      ) : null}

      <div className="choose-stage">
        {session.phase === 'running' ? (
          <>
            <div className="choose-lava" style={{ height: lavaHeight }} aria-hidden="true">
              <div className="choose-lava-surface" />
            </div>
            {variant === 'trainer' ? (
              <p className="choose-clock">{formatChooseClock(remaining)}</p>
            ) : null}
          </>
        ) : null}

        {session.phase === 'escaped' ? (
          <p className="choose-result">Ni klarade det!</p>
        ) : null}

        {session.phase === 'caught' ? (
          <>
            <div className="choose-lava choose-lava-full" aria-hidden="true">
              <div className="choose-lava-surface" />
            </div>
            <p className="choose-result">Lavan kom ikapp!</p>
          </>
        ) : null}

        {session.phase === 'idle' && variant === 'display' ? (
          <p className="choose-wait">Väntar på start.</p>
        ) : null}
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          {running ? (
            <>
              <button
                className="button"
                type="button"
                onClick={() =>
                  setChoosePathSession({ ...session, phase: 'escaped' })
                }
              >
                Klar – de hann!
              </button>
              <button
                className="button button-stop"
                type="button"
                onClick={() => setChoosePathSession({ ...idleChoosePathSession })}
              >
                Stoppa
              </button>
            </>
          ) : (
            <>
              <button className="button button-start" type="button" onClick={startLava}>
                {session.phase === 'idle' ? 'Starta' : 'Kör igen'}
              </button>
              {session.phase !== 'idle' ? (
                <button
                  className="button-ghost"
                  type="button"
                  onClick={() => setChoosePathSession({ ...idleChoosePathSession })}
                >
                  Rensa skärm
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
