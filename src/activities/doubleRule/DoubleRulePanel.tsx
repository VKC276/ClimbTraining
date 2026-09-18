import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import {
  doubleRuleIntro,
  drawDoubleRuleCard,
  idleDoubleRuleSession,
  shuffleDeck,
} from './model'

type DoubleRulePanelProps = {
  variant: 'display' | 'trainer'
}

export function DoubleRulePanel({ variant }: DoubleRulePanelProps) {
  const { snapshot, setDoubleRuleSession } = useGym()
  const config = snapshot.settings.doubleRule
  const session = snapshot.doubleRuleSession
  const hasCards = config.category1.length + config.category2.length > 0
  const remaining = session.remaining.length
  const started = Boolean(session.slot1 || session.slot2)

  const draw = () => {
    if (!hasCards) return
    setDoubleRuleSession(drawDoubleRuleCard(session, config))
  }

  return (
    <div className={`double-rule double-rule-${variant}`}>
      {variant === 'trainer' ? <p className="double-rule-hint">{doubleRuleIntro}</p> : null}

      <div className="double-rule-board">
        <article
          className={`double-rule-card${session.slot1 ? '' : ' double-rule-empty'}${session.lastCategory === 1 ? ' double-rule-fresh' : ''}`}
        >
          <p className="double-rule-cat">{config.category1Name}</p>
          {session.slot1 ? (
            <FitScale className="double-rule-fit">
              <h2>{session.slot1.title}</h2>
              <p>{session.slot1.text}</p>
            </FitScale>
          ) : (
            <p className="double-rule-wait">Väntar på kort</p>
          )}
        </article>
        <article
          className={`double-rule-card${session.slot2 ? '' : ' double-rule-empty'}${session.lastCategory === 2 ? ' double-rule-fresh' : ''}`}
        >
          <p className="double-rule-cat">{config.category2Name}</p>
          {session.slot2 ? (
            <FitScale className="double-rule-fit">
              <h2>{session.slot2.title}</h2>
              <p>{session.slot2.text}</p>
            </FitScale>
          ) : (
            <p className="double-rule-wait">Väntar på kort</p>
          )}
        </article>
      </div>

      {variant === 'trainer' ? (
        <div className="density-controls">
          <button className="button button-start" type="button" onClick={draw} disabled={!hasCards}>
            Dra kort
          </button>
          {started ? (
            <button
              className="button-ghost"
              type="button"
              onClick={() =>
                setDoubleRuleSession({
                  ...idleDoubleRuleSession,
                  remaining: shuffleDeck(config),
                })
              }
            >
              Ny lek
            </button>
          ) : null}
          <p className="double-rule-count">
            {remaining > 0
              ? `${remaining} kort kvar`
              : started
                ? 'Leken slut — nästa drag blandar om'
                : 'Redo att dra'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
