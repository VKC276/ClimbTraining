export type HdmiCommand = 'on' | 'off'

export type DisplayHardware = {
  hdmiOn: boolean
  hdmiCommand: HdmiCommand | null
  hdmiCommandId: number
  scheduleEnabled: boolean
  onTime: string
  offTime: string
}

export const defaultDisplayHardware: DisplayHardware = {
  hdmiOn: true,
  hdmiCommand: null,
  hdmiCommandId: 0,
  scheduleEnabled: false,
  onTime: '07:00',
  offTime: '22:00',
}

export const PI_HELPER_URL = 'http://127.0.0.1:8743'

export function isClockTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
}

function clockHm(value: string) {
  const [hours, minutes] = value.split(':')
  return `${hours}:${minutes}`
}

export function normalizeDisplayHardware(
  partial?: Partial<DisplayHardware>,
): DisplayHardware {
  return {
    hdmiOn: partial?.hdmiOn !== false,
    hdmiCommand:
      partial?.hdmiCommand === 'on' || partial?.hdmiCommand === 'off'
        ? partial.hdmiCommand
        : null,
    hdmiCommandId: Math.max(0, Math.round(Number(partial?.hdmiCommandId ?? 0) || 0)),
    scheduleEnabled: Boolean(partial?.scheduleEnabled),
    onTime: isClockTime(partial?.onTime ?? '')
      ? clockHm(partial!.onTime!)
      : defaultDisplayHardware.onTime,
    offTime: isClockTime(partial?.offTime ?? '')
      ? clockHm(partial!.offTime!)
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
