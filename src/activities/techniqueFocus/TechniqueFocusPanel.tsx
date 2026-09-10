import { useState, type FormEvent } from 'react'
import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  SPIN_DURATION_MS,
  buildSpinFrames,
  idleTechniqueFocusSession,
  normalizeFocusText,
  pickTechniqueFocus,
  visibleTechniqueFocus,
  techniqueFocusIntro,
} from './model'

type TechniqueFocusPanelProps = {
  variant: 'display' | 'trainer'
}

export function TechniqueFocusPanel({ variant }: TechniqueFocusPanelProps) {
  const now = useNow(40)
  const { snapshot, updateTechniqueFocus, setTechniqueFocusSession } = useGym()
  const focuses = snapshot.settings.techniqueFocus.focuses
  const session = snapshot.techniqueFocusSession
  const [draft, setDraft] = useState('')
  const spinning = session.frames.length > 0 && now.getTime() < session.endsAt
  const shown = visibleTechniqueFocus(session, now.getTime())
  const landed = Boolean(shown) && !spinning

  const spin = () => {
    if (focuses.length === 0) return
    const pick = pickTechniqueFocus(focuses, session.pick)
    const startedAt = Date.now()
    setTechniqueFocusSession({
      frames: buildSpinFrames(focuses, pick),
      pick,
      startedAt,
      endsAt: startedAt + SPIN_DURATION_MS,
    })
  }

  const addFocus = (event: FormEvent) => {
    event.preventDefault()
    const text = normalizeFocusText(draft)
    if (!text) return
    updateTechniqueFocus({ focuses: [...focuses, text] })
    setDraft('')
  }

  const removeFocus = (text: string) => {
    updateTechniqueFocus({ focuses: focuses.filter((item) => item !== text) })
  }

  return (
    <div
      className={`tech-focus tech-focus-${variant}${spinning ? ' tech-focus-spinning' : ''}${landed ? ' tech-focus-landed' : ''}`}
    >
      {variant === 'trainer' ? (
        <form className="tech-focus-editor" onSubmit={addFocus}>
          <p className="tech-focus-hint">
            {techniqueFocusIntro} Listan sparas till nästa gång.
          </p>
          <ul className="tech-focus-list">
            {focuses.map((item) => (
              <li key={item}>
                <span>{item}</span>
                <button
                  className="button-ghost tech-focus-remove"
                  type="button"
                  onClick={() => removeFocus(item)}
                  disabled={focuses.length <= 2}
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
              maxLength={80}
              placeholder="Nytt teknikfokus"
              aria-label="Nytt teknikfokus"
            />
            <button className="button" type="submit" disabled={!normalizeFocusText(draft)}>
              Lägg till
            </button>
          </div>
        </form>
      ) : null}

      <div className="tech-focus-stage">
        {shown && variant === 'display' && spinning ? (
          <div className="tech-focus-spin-center">
            <p className="tech-focus-text" key={shown}>
              {shown}
            </p>
          </div>
        ) : null}

        {shown && variant === 'display' && landed ? (
          <FitScale className="density-fit tech-focus-fill">
            <p className="tech-focus-text">{shown}</p>
          </FitScale>
        ) : null}

        {shown && variant === 'trainer' ? (
          <div className="tech-focus-live">
            <p className="tech-focus-kicker">
              {spinning ? 'Slumpar…' : 'Valt fokus'}
            </p>
            <p className="tech-focus-text">{shown}</p>
          </div>
        ) : null}

        {!shown ? (
          <p className="tech-focus-wait">
            {variant === 'trainer'
              ? 'Tryck Slumpa när gruppen är redo för nästa boulder eller rutt.'
              : 'Väntar på teknikfokus.'}
          </p>
        ) : null}
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          <button
            className="button"
            type="button"
            onClick={spin}
            disabled={spinning || focuses.length < 2}
          >
            {shown ? 'Slumpa igen' : 'Slumpa'}
          </button>
          {session.pick ? (
            <button
              className="button-ghost"
              type="button"
              onClick={() => setTechniqueFocusSession({ ...idleTechniqueFocusSession })}
            >
              Rensa skärm
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
