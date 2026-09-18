import { FitScale } from '../../components/FitScale'
import { useGym } from '../../gym/GymContext'
import { useNow } from '../../hooks/useNow'
import {
  doubleRuleIntro,
  idleDoubleRuleSession,
  isDoubleRuleSpinning,
  shuffleDeck,
  startDoubleRuleDraw,
  visibleSlot,
  type TwoCardCategory,
  type TwoCardItem,
} from './model'

type DoubleRulePanelProps = {
  variant: 'display' | 'trainer'
}

export function DoubleRulePanel({ variant }: DoubleRulePanelProps) {
  const now = useNow(40)
  const { snapshot, setDoubleRuleSession } = useGym()
  const config = snapshot.settings.doubleRule
  const session = snapshot.doubleRuleSession
  const hasCards = config.category1.length + config.category2.length > 0
  const remaining = session.remaining.length
  const started = Boolean(session.slot1 || session.slot2)
  const spinning = isDoubleRuleSpinning(session, now.getTime())
  const stamp = now.getTime()

  const draw = () => {
    if (!hasCards || spinning) return
    setDoubleRuleSession(startDoubleRuleDraw(session, config))
  }

  if (variant === 'trainer') {
    return (
      <div className="double-rule double-rule-trainer">
        <p className="double-rule-hint">{doubleRuleIntro}</p>
        <div className="density-controls">
          <button
            className="button button-start"
            type="button"
            onClick={draw}
            disabled={!hasCards || spinning}
          >
            {started || spinning ? 'Dra igen' : 'Dra kort'}
          </button>
          {started || spinning ? (
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
            {spinning
              ? 'Slumpar…'
              : remaining > 0
                ? `${remaining} kort kvar`
                : started
                  ? 'Leken slut — nästa drag blandar om'
                  : 'Redo att dra'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`double-rule double-rule-display${spinning ? ' double-rule-spinning' : ''}`}
    >
      <div className="double-rule-board">
        <Slot
          name={config.category1Name}
          category={1}
          card={visibleSlot(session, 1, stamp)}
          spinning={spinning && session.lastCategory === 1}
          last={session.lastCategory === 1 && !spinning}
        />
        <Slot
          name={config.category2Name}
          category={2}
          card={visibleSlot(session, 2, stamp)}
          spinning={spinning && session.lastCategory === 2}
          last={session.lastCategory === 2 && !spinning}
        />
      </div>
    </div>
  )
}

function Slot({
  name,
  category,
  card,
  spinning,
  last,
}: {
  name: string
  category: TwoCardCategory
  card: TwoCardItem | null
  spinning: boolean
  last: boolean
}) {
  return (
    <article
      className={`double-rule-card${card ? '' : ' double-rule-empty'}${spinning ? ' double-rule-spin-slot' : ''}${last ? ' double-rule-fresh' : ''}`}
    >
      <p className="double-rule-cat">{name}</p>
      {spinning && card ? (
        <div className="double-rule-spin-center">
          <h2 className="double-rule-title" key={`${category}-${card.title}`}>
            {card.title}
          </h2>
        </div>
      ) : null}
      {card && !spinning ? (
        <FitScale className="double-rule-fit">
          <h2 className="double-rule-title">{card.title}</h2>
          {card.text ? <p className="double-rule-text">{card.text}</p> : null}
        </FitScale>
      ) : null}
      {!card ? <p className="double-rule-wait">Väntar på kort</p> : null}
    </article>
  )
}
