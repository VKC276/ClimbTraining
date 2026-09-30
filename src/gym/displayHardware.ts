export type HdmiCommand = 'on' | 'off'

export type DisplayMode = 'off' | 'schedule' | 'radar'

export type DisplayHardware = {
  hdmiOn: boolean
  hdmiCommand: HdmiCommand | null
  hdmiCommandId: number
  mode: DisplayMode
  onTime: string
  offTime: string
  radarIdleMinutes: number
}

export const defaultDisplayHardware: DisplayHardware = {
  hdmiOn: true,
  hdmiCommand: null,
  hdmiCommandId: 0,
  mode: 'off',
  onTime: '07:00',
  offTime: '22:00',
  radarIdleMinutes: 120,
}

export const PI_HELPER_URL = 'http://127.0.0.1:8743'

export const radarIdleMinuteOptions = [15, 30, 60, 90, 120, 180, 240]

export function isClockTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
}

function clockHm(value: string) {
  const [hours, minutes] = value.split(':')
  return `${hours}:${minutes}`
}

function normalizeMode(partial?: Partial<DisplayHardware> & { scheduleEnabled?: boolean }): DisplayMode {
  if (partial?.mode === 'off' || partial?.mode === 'schedule' || partial?.mode === 'radar') {
    return partial.mode
  }
  if (partial?.scheduleEnabled === true) return 'schedule'
  return defaultDisplayHardware.mode
}

export function normalizeDisplayHardware(
  partial?: Partial<DisplayHardware> & { scheduleEnabled?: boolean },
): DisplayHardware {
  const radarIdle = Math.round(Number(partial?.radarIdleMinutes ?? defaultDisplayHardware.radarIdleMinutes) || 0)
  return {
    hdmiOn: partial?.hdmiOn !== false,
    hdmiCommand:
      partial?.hdmiCommand === 'on' || partial?.hdmiCommand === 'off'
        ? partial.hdmiCommand
        : null,
    hdmiCommandId: Math.max(0, Math.round(Number(partial?.hdmiCommandId ?? 0) || 0)),
    mode: normalizeMode(partial),
    onTime: isClockTime(partial?.onTime ?? '')
      ? clockHm(partial!.onTime!)
      : defaultDisplayHardware.onTime,
    offTime: isClockTime(partial?.offTime ?? '')
      ? clockHm(partial!.offTime!)
      : defaultDisplayHardware.offTime,
    radarIdleMinutes: radarIdleMinuteOptions.includes(radarIdle)
      ? radarIdle
      : defaultDisplayHardware.radarIdleMinutes,
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
