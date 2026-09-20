import { useEffect } from 'react'
import { NumberField } from '../../components/NumberField'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  catchHoldColors,
  getCatchHoldColor,
  idleCatchHoldSession,
  isLightHex,
  pickCatchHoldColor,
  type CatchHoldColorId,
} from './model'
import { announceCatchHoldColor } from './speech'

type CatchHoldPanelProps = {
  variant: 'display' | 'trainer'
}

export function CatchHoldPanel({ variant }: CatchHoldPanelProps) {
  const now = useNow(80)
  const { snapshot, updateCatchHold, setCatchHoldSession } = useGym()
  const config = snapshot.settings.catchHold
  const session = snapshot.catchHoldSession
  const running = session.phase === 'countdown' || session.phase === 'color'
  const color = getCatchHoldColor(session.colorId)
  const remaining = Math.max(0, Math.ceil((session.phaseEndsAt - now.getTime()) / 1000))
  const light = color ? isLightHex(color.hex) : false

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.catchHoldSession
      if (Date.now() < current.phaseEndsAt) return
      if (current.phase === 'countdown') {
        const colorId = pickCatchHoldColor(config.colorIds, current.colorId)
        setCatchHoldSession({
          phase: 'color',
          round: current.round,
          colorId,
          phaseEndsAt: Date.now() + config.betweenRoundsSeconds * 1000,
        })
        return
      }
      if (current.phase === 'color') {
        if (current.round >= config.rounds) {
          setCatchHoldSession({
            phase: 'done',
            round: current.round,
            colorId: current.colorId,
            phaseEndsAt: 0,
          })
          return
        }
        setCatchHoldSession({
          phase: 'countdown',
          round: current.round + 1,
          colorId: null,
          phaseEndsAt: Date.now() + config.countdownSeconds * 1000,
        })
      }
    }, 50)
    return () => window.clearInterval(id)
  }, [
    variant,
    running,
    snapshot.catchHoldSession,
    config.colorIds,
    config.betweenRoundsSeconds,
    config.rounds,
    config.countdownSeconds,
    setCatchHoldSession,
  ])

  useEffect(() => {
    if (variant !== 'display') return
    if (!config.soundOn || session.phase !== 'color' || !color) return
    void announceCatchHoldColor(color)
  }, [variant, config.soundOn, session.phase, session.round, color])

  const startGame = () => {
    setCatchHoldSession({
      phase: 'countdown',
      round: 1,
      colorId: null,
      phaseEndsAt: Date.now() + config.countdownSeconds * 1000,
    })
  }

  const stopGame = () => setCatchHoldSession({ ...idleCatchHoldSession })

  const toggleColor = (id: CatchHoldColorId) => {
    const selected = config.colorIds.includes(id)
      ? config.colorIds.filter((item) => item !== id)
      : [...config.colorIds, id]
    if (selected.length === 0) return
    updateCatchHold({ colorIds: selected })
  }

  return (
    <div className={`catch-hold catch-hold-${variant}`}>
      {variant === 'trainer' && !running ? (
        <form className="catch-hold-settings" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend>Färger</legend>
            <div className="catch-hold-swatches">
              {catchHoldColors.map((item) => {
                const on = config.colorIds.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={on ? 'catch-swatch on' : 'catch-swatch'}
                    style={{ background: item.hex, color: isLightHex(item.hex) ? '#111' : '#fff' }}
                    onClick={() => toggleColor(item.id)}
                    aria-pressed={on}
                  >
                    {item.name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <NumberField
            label="Nedräkningstid (sekunder)"
            min={1}
            max={60}
            value={config.countdownSeconds}
            onChange={(countdownSeconds) => updateCatchHold({ countdownSeconds })}
          />
          <NumberField
            label="Antal omgångar"
            min={1}
            max={99}
            value={config.rounds}
            onChange={(rounds) => updateCatchHold({ rounds })}
          />
          <NumberField
            label="Tid mellan omgångar (sekunder)"
            min={1}
            max={300}
            value={config.betweenRoundsSeconds}
            onChange={(betweenRoundsSeconds) =>
              updateCatchHold({ betweenRoundsSeconds })
            }
          />

          <label className={config.soundOn ? 'choice selected' : 'choice'}>
            <input
              type="checkbox"
              checked={config.soundOn}
              onChange={(event) => updateCatchHold({ soundOn: event.target.checked })}
            />
            Ljud på (t.ex. ”Blå!”)
          </label>
        </form>
      ) : null}

      <div
        className={
          light ? 'catch-hold-stage catch-hold-light' : 'catch-hold-stage'
        }
        style={
          session.phase === 'color' && color
            ? { background: color.hex, color: light ? '#111' : '#fff' }
            : undefined
        }
      >
        {session.phase === 'idle' ? (
          <p className="catch-hold-wait">
            {variant === 'trainer'
              ? 'Starta när deltagarna är redo.'
              : 'Titta på skärmen och fånga rätt färg.'}
          </p>
        ) : null}

        {session.phase === 'countdown' ? (
          <>
            <p className="catch-hold-round">
              Omgång {session.round} / {config.rounds}
            </p>
            <p className="catch-hold-count">{Math.max(1, remaining)}</p>
          </>
        ) : null}

        {session.phase === 'color' && color ? (
          <>
            <p className="catch-hold-round">
              Omgång {session.round} / {config.rounds}
            </p>
            <p className="catch-hold-name">{color.name}!</p>
            <p className="catch-hold-next">Nästa omgång om {remaining} s</p>
          </>
        ) : null}

        {session.phase === 'done' ? (
          <p className="catch-hold-name">Klart!</p>
        ) : null}
      </div>

      {variant === 'trainer' ? (
        <div className="catch-hold-controls">
          {running ? (
            <button className="button button-stop" type="button" onClick={stopGame}>
              Stoppa
            </button>
          ) : (
            <button className="button button-start" type="button" onClick={startGame}>
              {session.phase === 'done' ? 'Kör igen' : 'Starta'}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
