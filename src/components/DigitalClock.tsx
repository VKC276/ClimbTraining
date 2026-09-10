type DigitalClockProps = {
  time: Date
  size?: 'idle' | 'overlay'
  withSeconds?: boolean
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function DigitalClock({
  time,
  size = 'idle',
  withSeconds = true,
}: DigitalClockProps) {
  const hours = pad(time.getHours())
  const minutes = pad(time.getMinutes())
  const seconds = pad(time.getSeconds())

  return (
    <time
      className={`digital-clock digital-clock-${size}`}
      dateTime={`${hours}:${minutes}:${seconds}`}
    >
      <span>
        {hours}:{minutes}
      </span>
      {withSeconds ? <span className="digital-seconds">:{seconds}</span> : null}
    </time>
  )
}
