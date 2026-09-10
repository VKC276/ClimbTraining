import type { DensitySignalId } from '../densityCircuit/model'
import { densitySignalOptions } from '../densityCircuit/model'

export type { DensitySignalId }
export { densitySignalOptions }

export type FingerboardConfig = {
  hangSeconds: number
  shortRestSeconds: number
  reps: number
  setRestSeconds: number
  sets: number
  hangSignal: DensitySignalId
  restSignal: DensitySignalId
}

export type FingerboardKind = 'hang' | 'short-rest' | 'set-rest'

export type FingerboardSession = {
  phase: 'idle' | 'running' | 'done'
  set: number
  rep: number
  kind: FingerboardKind
  phaseEndsAt: number
}

export const defaultFingerboardConfig: FingerboardConfig = {
  hangSeconds: 7,
  shortRestSeconds: 3,
  reps: 6,
  setRestSeconds: 180,
  sets: 3,
  hangSignal: 'double',
  restSignal: 'beep',
}

export const idleFingerboardSession: FingerboardSession = {
  phase: 'idle',
  set: 0,
  rep: 0,
  kind: 'hang',
  phaseEndsAt: 0,
}

export const fingerboardIntro =
  'Klassiska repeaters. Ställ in tiderna, så räknar skärmen häng, vila och set.'

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function asSignal(value: unknown, fallback: DensitySignalId): DensitySignalId {
  return densitySignalOptions.some((option) => option.id === value)
    ? (value as DensitySignalId)
    : fallback
}

export function normalizeFingerboardConfig(
  partial?: Partial<FingerboardConfig>,
): FingerboardConfig {
  return {
    hangSeconds: asInt(partial?.hangSeconds, defaultFingerboardConfig.hangSeconds, 3, 20),
    shortRestSeconds: asInt(
      partial?.shortRestSeconds,
      defaultFingerboardConfig.shortRestSeconds,
      1,
      15,
    ),
    reps: asInt(partial?.reps, defaultFingerboardConfig.reps, 2, 12),
    setRestSeconds: asInt(
      partial?.setRestSeconds,
      defaultFingerboardConfig.setRestSeconds,
      30,
      600,
    ),
    sets: asInt(partial?.sets, defaultFingerboardConfig.sets, 1, 8),
    hangSignal: asSignal(partial?.hangSignal, defaultFingerboardConfig.hangSignal),
    restSignal: asSignal(partial?.restSignal, defaultFingerboardConfig.restSignal),
  }
}

export function formatFingerClock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return `${seconds}`
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function phaseDurationMs(config: FingerboardConfig, session: FingerboardSession) {
  if (session.kind === 'hang') return config.hangSeconds * 1000
  if (session.kind === 'short-rest') return config.shortRestSeconds * 1000
  return config.setRestSeconds * 1000
}

export function startFingerboardSession(config: FingerboardConfig): FingerboardSession {
  const session: FingerboardSession = {
    phase: 'running',
    set: 1,
    rep: 1,
    kind: 'hang',
    phaseEndsAt: 0,
  }
  return { ...session, phaseEndsAt: Date.now() + phaseDurationMs(config, session) }
}

export function advanceFingerboard(
  config: FingerboardConfig,
  current: FingerboardSession,
): FingerboardSession {
  if (current.kind === 'hang') {
    if (current.rep < config.reps) {
      const next: FingerboardSession = { ...current, kind: 'short-rest' }
      return { ...next, phaseEndsAt: Date.now() + phaseDurationMs(config, next) }
    }
    if (current.set < config.sets) {
      const next: FingerboardSession = { ...current, kind: 'set-rest' }
      return { ...next, phaseEndsAt: Date.now() + phaseDurationMs(config, next) }
    }
    return { ...current, phase: 'done', phaseEndsAt: 0 }
  }

  if (current.kind === 'short-rest') {
    const next: FingerboardSession = {
      ...current,
      kind: 'hang',
      rep: current.rep + 1,
    }
    return { ...next, phaseEndsAt: Date.now() + phaseDurationMs(config, next) }
  }

  const next: FingerboardSession = {
    ...current,
    kind: 'hang',
    set: current.set + 1,
    rep: 1,
  }
  return { ...next, phaseEndsAt: Date.now() + phaseDurationMs(config, next) }
}

export function headlineFor(config: FingerboardConfig, session: FingerboardSession) {
  if (session.kind === 'hang') return `Häng ${config.hangSeconds}s`
  if (session.kind === 'short-rest') return `Vila ${config.shortRestSeconds}s`
  const minutes = config.setRestSeconds / 60
  return Number.isInteger(minutes) ? `Vila ${minutes} min` : `Vila ${config.setRestSeconds}s`
}

export function detailFor(config: FingerboardConfig, session: FingerboardSession) {
  if (session.kind === 'hang') return `${config.hangSeconds}s häng`
  if (session.kind === 'short-rest') return `${config.shortRestSeconds}s vila`
  return `${Math.round(config.setRestSeconds / 60)} min vila, sedan set ${session.set + 1}`
}

export function summaryFor(config: FingerboardConfig) {
  return `${config.hangSeconds}s häng / ${config.shortRestSeconds}s vila × ${config.reps}, ${config.sets} set.`
}
