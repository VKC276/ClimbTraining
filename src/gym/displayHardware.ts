export type DisplayHardware = {
  volume: number
  hdmiOn: boolean
  scheduleEnabled: boolean
  onTime: string
  offTime: string
}

export const defaultDisplayHardware: DisplayHardware = {
  volume: 80,
  hdmiOn: true,
  scheduleEnabled: false,
  onTime: '07:00',
  offTime: '22:00',
}

export const PI_HELPER_URL = 'http://127.0.0.1:8743'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function isClockTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function normalizeDisplayHardware(
  partial?: Partial<DisplayHardware>,
): DisplayHardware {
  return {
    volume: clamp(Math.round(Number(partial?.volume ?? defaultDisplayHardware.volume)), 0, 100),
    hdmiOn: partial?.hdmiOn !== false,
    scheduleEnabled: Boolean(partial?.scheduleEnabled),
    onTime: isClockTime(partial?.onTime ?? '')
      ? partial!.onTime!
      : defaultDisplayHardware.onTime,
    offTime: isClockTime(partial?.offTime ?? '')
      ? partial!.offTime!
      : defaultDisplayHardware.offTime,
  }
}

export function minutesFromClock(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function screenScheduledOn(now: Date, onTime: string, offTime: string) {
  const current = now.getHours() * 60 + now.getMinutes()
  const on = minutesFromClock(onTime)
  const off = minutesFromClock(offTime)
  if (on === off) return true
  if (on < off) return current >= on && current < off
  return current >= on || current < off
}
