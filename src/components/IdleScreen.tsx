import { AnalogClock } from './AnalogClock'
import { DigitalClock } from './DigitalClock'
import { Logo } from './Logo'
import type { ClockStyle } from '../types'
import type { CSSProperties } from 'react'

type IdleScreenProps = {
  time: Date
  clockStyle: ClockStyle
  screenId: string
  logoSize: number
  clockSize: number
  screenIdSize: number
}

export function IdleScreen({
  time,
  clockStyle,
  screenId,
  logoSize,
  clockSize,
  screenIdSize,
}: IdleScreenProps) {
  const dateLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(time)

  const sizes = {
    '--idle-logo-scale': logoSize / 100,
    '--idle-clock-scale': clockSize / 100,
    '--idle-id-scale': screenIdSize / 100,
  } as CSSProperties

  return (
    <div className="idle-screen" style={sizes}>
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
      {screenId ? <p className="idle-screen-id">{screenId}</p> : null}
    </div>
  )
}
