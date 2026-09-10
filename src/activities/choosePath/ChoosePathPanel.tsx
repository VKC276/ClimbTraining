import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  choosePathIntro,
  createStoryId,
  formatChooseClock,
  getStory,
  idleChoosePathSession,
  lavaProgress,
  normalizeStoryText,
  pickTwoPaths,
} from './model'

type ChoosePathPanelProps = {
  variant: 'display' | 'trainer'
}

export function ChoosePathPanel({ variant }: ChoosePathPanelProps) {
  const now = useNow(50)
  const { snapshot, updateChoosePath, setChoosePathSession } = useGym()
  const stories = snapshot.settings.choosePath.stories
  const session = snapshot.choosePathSession
  const story = getStory(stories, session.storyId)
  const pathA = getStory(stories, session.pathAId)
  const pathB = getStory(stories, session.pathBId)
  const running = session.phase === 'running'
  const remaining = Math.max(0, Math.ceil((session.endsAt - now.getTime()) / 1000))
  const progress = lavaProgress(session.startedAt, session.endsAt, now.getTime())
  const handledEnd = useRef('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [seconds, setSeconds] = useState(45)

  useEffect(() => {
    if (variant !== 'trainer' || !running) return
    const id = window.setInterval(() => {
      const current = snapshot.choosePathSession
      if (Date.now() < current.endsAt) return
      const endKey = `${current.storyId}-${current.endsAt}`
      if (handledEnd.current === endKey) return
      handledEnd.current = endKey
      setChoosePathSession({
        ...current,
        phase: 'caught',
      })
    }, 50)
    return () => window.clearInterval(id)
  }, [variant, running, snapshot.choosePathSession, setChoosePathSession])

  const startStory = (storyId: string) => {
    const chosen = getStory(stories, storyId)
    if (!chosen) return
    const startedAt = Date.now()
    setChoosePathSession({
      phase: 'running',
      storyId: chosen.id,
      pathAId: session.pathAId,
      pathBId: session.pathBId,
      startedAt,
      endsAt: startedAt + chosen.seconds * 1000,
    })
  }

  const offerPaths = () => {
    const paths = pickTwoPaths(stories, session.storyId)
    setChoosePathSession({
      ...idleChoosePathSession,
      phase: 'choose',
      pathAId: paths.pathAId,
      pathBId: paths.pathBId,
    })
  }

  const addStory = (event: FormEvent) => {
    event.preventDefault()
    const nextTitle = normalizeStoryText(title, 48)
    const nextStory = normalizeStoryText(text, 180)
    if (!nextTitle || !nextStory) return
    updateChoosePath({
      stories: [
        ...stories,
        {
          id: createStoryId(),
          title: nextTitle,
          story: nextStory,
          seconds,
        },
      ],
    })
    setTitle('')
    setText('')
    setSeconds(45)
  }

  const lavaHeight = `${Math.round(progress * 1000) / 10}%`

  return (
    <div className={`choose choose-${variant} choose-${session.phase}`}>
      {variant === 'trainer' && session.phase !== 'running' ? (
        <div className="choose-editor">
          <p className="choose-hint">{choosePathIntro}</p>
          <ul className="choose-story-list">
            {stories.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {item.seconds} s · {item.story}
                  </span>
                </div>
                <div className="choose-story-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => startStory(item.id)}
                  >
                    Starta
                  </button>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() =>
                      updateChoosePath({
                        stories: stories.filter((storyItem) => storyItem.id !== item.id),
                      })
                    }
                    disabled={stories.length <= 2}
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <form className="choose-add" onSubmit={addStory}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={48}
              placeholder="Titel, t.ex. Flykten från lavan"
              aria-label="Berättelsetitel"
            />
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={180}
              rows={2}
              placeholder="Kort scenario som visas på TV:n"
              aria-label="Scenario"
            />
            <label className="field">
              <span>Tid (sekunder)</span>
              <input
                type="number"
                min={15}
                max={180}
                step={1}
                value={seconds}
                onChange={(event) => setSeconds(Number(event.target.value))}
              />
            </label>
            <button
              className="button"
              type="submit"
              disabled={!normalizeStoryText(title, 48) || !normalizeStoryText(text, 180)}
            >
              Lägg till berättelse
            </button>
          </form>
        </div>
      ) : null}

      <div className="choose-stage">
        {session.phase === 'running' ? (
          <>
            <div className="choose-lava" style={{ height: lavaHeight }} aria-hidden="true">
              <div className="choose-lava-surface" />
            </div>
            <div className="choose-story">
              {variant === 'display' ? (
                <FitScale className="density-fit">
                  <p className="choose-story-text">{story?.story}</p>
                </FitScale>
              ) : (
                <>
                  <p className="choose-kicker">{story?.title}</p>
                  <p className="choose-story-text">{story?.story}</p>
                  <p className="choose-clock">{formatChooseClock(remaining)}</p>
                </>
              )}
            </div>
          </>
        ) : null}

        {session.phase === 'choose' ? (
          <div className="choose-paths">
            <p className="choose-kicker">Välj er väg</p>
            <div className="choose-path-cards">
              {pathA ? (
                variant === 'trainer' ? (
                  <button
                    className="choose-path-card"
                    type="button"
                    onClick={() => startStory(pathA.id)}
                  >
                    <span>Väg A</span>
                    <strong>{pathA.title}</strong>
                  </button>
                ) : (
                  <div className="choose-path-card">
                    <span>Väg A</span>
                    <strong>{pathA.title}</strong>
                  </div>
                )
              ) : null}
              {pathB ? (
                variant === 'trainer' ? (
                  <button
                    className="choose-path-card"
                    type="button"
                    onClick={() => startStory(pathB.id)}
                  >
                    <span>Väg B</span>
                    <strong>{pathB.title}</strong>
                  </button>
                ) : (
                  <div className="choose-path-card">
                    <span>Väg B</span>
                    <strong>{pathB.title}</strong>
                  </div>
                )
              ) : null}
            </div>
          </div>
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
          <p className="choose-wait">Välj en väg och börja äventyret.</p>
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
                className="button-ghost"
                type="button"
                onClick={() => setChoosePathSession({ ...idleChoosePathSession })}
              >
                Stoppa
              </button>
            </>
          ) : (
            <>
              <button className="button" type="button" onClick={offerPaths}>
                Låt barnen välja väg
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
