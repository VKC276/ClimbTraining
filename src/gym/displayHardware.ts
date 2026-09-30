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

export const radarIdleMinutesMin = 1
export const radarIdleMinutesMax = 8 * 60 // 8 timmar

/** Valbara tider: 1–45 min, sedan varje halvtimme upp till 8 h. */
export const radarIdleMinuteOptions: number[] = [
  1, 2, 3, 5, 10, 15, 20, 30, 45,
  ...Array.from({ length: 15 }, (_, i) => (i + 2) * 30), // 60 … 480
]

export function clampRadarIdleMinutes(value: number) {
  const rounded = Math.round(Number(value) || 0)
  if (!Number.isFinite(rounded)) return defaultDisplayHardware.radarIdleMinutes
  return Math.min(radarIdleMinutesMax, Math.max(radarIdleMinutesMin, rounded))
}

export function formatRadarIdleMinutes(minutes: number) {
  if (minutes < 60) {
    return minutes === 1 ? '1 minut' : `${minutes} minuter`
  }
  const hours = minutes / 60
  if (Number.isInteger(hours)) {
    return hours === 1 ? '1 timme' : `${hours} timmar`
  }
  const whole = Math.floor(hours)
  const mins = minutes % 60
  return `${whole} h ${mins} min`
}

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
  const radarIdle = clampRadarIdleMinutes(
    Number(partial?.radarIdleMinutes ?? defaultDisplayHardware.radarIdleMinutes),
  )
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
    radarIdleMinutes: radarIdle,
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
