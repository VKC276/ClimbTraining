import { AnalogClock } from './AnalogClock'
import { DigitalClock } from './DigitalClock'
import { Logo } from './Logo'
import type { ClockStyle } from '../types'

type IdleScreenProps = {
  time: Date
  clockStyle: ClockStyle
}

export function IdleScreen({ time, clockStyle }: IdleScreenProps) {
  const dateLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(time)

  return (
    <div className="idle-screen">
      <div className="idle-center">
        <Logo className="idle-logo" />
        <div className="idle-clock">
          {clockStyle === 'analog' ? (
            <AnalogClock time={time} />
          ) : (
            <DigitalClock time={time} size="idle" />
          )}
        </div>
        <p className="idle-date">{dateLabel}</p>
      </div>
    </div>
  )
}
