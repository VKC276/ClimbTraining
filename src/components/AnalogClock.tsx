type AnalogClockProps = {
  time: Date
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function AnalogClock({ time }: AnalogClockProps) {
  const hours = time.getHours() % 12
  const minutes = time.getMinutes()
  const seconds = time.getSeconds()
  const ms = time.getMilliseconds()

  const hourAngle = (hours + minutes / 60) * 30
  const minuteAngle = (minutes + seconds / 60) * 6
  const secondAngle = (seconds + ms / 1000) * 6

  const ticks = Array.from({ length: 60 }, (_, index) => index)

  return (
    <div
      className="analog-clock"
      role="img"
      aria-label={`${pad(time.getHours())}:${pad(minutes)}`}
    >
      <svg viewBox="0 0 200 200">
        <circle className="analog-face" cx="100" cy="100" r="96" />
        <circle className="analog-ring" cx="100" cy="100" r="88" />
        {ticks.map((tick) => {
          const major = tick % 5 === 0
          const angle = (tick * 6 * Math.PI) / 180
          const inner = major ? 74 : 80
          const outer = 86
          const x1 = 100 + inner * Math.sin(angle)
          const y1 = 100 - inner * Math.cos(angle)
          const x2 = 100 + outer * Math.sin(angle)
          const y2 = 100 - outer * Math.cos(angle)
          return (
            <line
              key={tick}
              className={major ? 'analog-tick analog-tick-major' : 'analog-tick'}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            />
          )
        })}
        <g transform={`rotate(${hourAngle} 100 100)`}>
          <line className="analog-hand analog-hour" x1="100" y1="108" x2="100" y2="48" />
        </g>
        <g transform={`rotate(${minuteAngle} 100 100)`}>
          <line className="analog-hand analog-minute" x1="100" y1="112" x2="100" y2="32" />
        </g>
        <g transform={`rotate(${secondAngle} 100 100)`}>
          <line className="analog-hand analog-second" x1="100" y1="118" x2="100" y2="26" />
        </g>
        <circle className="analog-cap" cx="100" cy="100" r="5" />
      </svg>
    </div>
  )
}
