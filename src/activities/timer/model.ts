import type { DensitySignalId } from '../densityCircuit/model'
import { densitySignalOptions } from '../densityCircuit/model'

export type { DensitySignalId }
export { densitySignalOptions }

export type TimerConfig = {
  minutes: number
  seconds: number
  loop: boolean
  doneSignal: DensitySignalId
}

export type TimerSession = {
  phase: 'idle' | 'running' | 'paused' | 'done'
  phaseEndsAt: number
  remainingMs: number
}

export const defaultTimerConfig: TimerConfig = {
  minutes: 5,
  seconds: 0,
  loop: false,
  doneSignal: 'bell',
}

export const idleTimerSession: TimerSession = {
  phase: 'idle',
  phaseEndsAt: 0,
  remainingMs: 0,
}

export const timerIntro =
  'Stor nedräkning på gymskärmen. Välj tid, starta, pausa och nollställ när ni vill.'

export const timerPresets = [
  { label: '30 s', minutes: 0, seconds: 30 },
  { label: '1 min', minutes: 1, seconds: 0 },
  { label: '2 min', minutes: 2, seconds: 0 },
  { label: '3 min', minutes: 3, seconds: 0 },
  { label: '5 min', minutes: 5, seconds: 0 },
  { label: '10 min', minutes: 10, seconds: 0 },
]

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function asSignal(value: unknown, fallback: DensitySignalId): DensitySignalId {
  return densitySignalOptions.some((option) => option.id === value)
    ? (value as DensitySignalId)
    : fallback
}

export function normalizeTimerConfig(partial?: Partial<TimerConfig>): TimerConfig {
  const config = {
    minutes: asInt(partial?.minutes, defaultTimerConfig.minutes, 0, 99),
    seconds: asInt(partial?.seconds, defaultTimerConfig.seconds, 0, 59),
    loop: partial?.loop === true,
    doneSignal: asSignal(partial?.doneSignal, defaultTimerConfig.doneSignal),
  }
  if (config.minutes === 0 && config.seconds < 5) {
    config.seconds = 5
  }
  return config
}

export function timerDurationMs(config: TimerConfig) {
  return (config.minutes * 60 + config.seconds) * 1000
}

export function formatTimerClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function remainingSeconds(
  config: TimerConfig,
  session: TimerSession,
  now: number,
) {
  if (session.phase === 'running') {
    const left = Math.max(0, Math.ceil((session.phaseEndsAt - now) / 1000))
    return Math.min(Math.round(timerDurationMs(config) / 1000), left)
  }
  if (session.phase === 'paused') {
    return Math.max(0, Math.ceil(session.remainingMs / 1000))
  }
  if (session.phase === 'done') return 0
  return config.minutes * 60 + config.seconds
}

export function startTimer(config: TimerConfig): TimerSession {
  const remainingMs = timerDurationMs(config)
  return {
    phase: 'running',
    remainingMs,
    phaseEndsAt: Date.now() + remainingMs,
  }
}

export function pauseTimer(session: TimerSession): TimerSession {
  if (session.phase !== 'running') return session
  return {
    phase: 'paused',
    remainingMs: Math.max(0, session.phaseEndsAt - Date.now()),
    phaseEndsAt: 0,
  }
}

export function resumeTimer(session: TimerSession): TimerSession {
  if (session.phase !== 'paused') return session
  return {
    phase: 'running',
    remainingMs: session.remainingMs,
    phaseEndsAt: Date.now() + session.remainingMs,
  }
}

export function finishOrLoop(config: TimerConfig): TimerSession {
  if (config.loop) return startTimer(config)
  return { phase: 'done', remainingMs: 0, phaseEndsAt: 0 }
}
