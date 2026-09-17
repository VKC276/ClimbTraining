import type { DensitySignalId } from '../densityCircuit/model'
import { densitySignalOptions } from '../densityCircuit/model'

export type { DensitySignalId }
export { densitySignalOptions }

export const defaultEmomExercises = [
  '1 boulderproblem – valfri svårighet',
  '5 pull-ups',
  '10 core-reps (t.ex. hanging knee raises)',
  'Vila',
]

export type EmomConfig = {
  exercises: string[]
  intervalSeconds: number
  totalRounds: number
  warnSeconds: number
  warnSignal: DensitySignalId
  goSignal: DensitySignalId
}

export type EmomSession = {
  phase: 'idle' | 'running' | 'done'
  round: number
  phaseEndsAt: number
}

export const defaultEmomConfig: EmomConfig = {
  exercises: [...defaultEmomExercises],
  intervalSeconds: 60,
  totalRounds: 20,
  warnSeconds: 10,
  warnSignal: 'beep',
  goSignal: 'double',
}

export const idleEmomSession: EmomSession = {
  phase: 'idle',
  round: 0,
  phaseEndsAt: 0,
}

export const emomIntro =
  'Varje intervall, på slaget, görs en given övning. Blir ni klara tidigt vilar ni tills nästa start. Blir ni inte klara går ni ändå vidare – för lätt ger mer vila, för tungt ingen vila alls.'

const MAX_EXERCISE_LENGTH = 90
const MAX_EXERCISES = 20

export function normalizeExerciseText(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_EXERCISE_LENGTH)
}

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function asSignal(value: unknown, fallback: DensitySignalId): DensitySignalId {
  return densitySignalOptions.some((option) => option.id === value)
    ? (value as DensitySignalId)
    : fallback
}

export function normalizeEmomConfig(partial?: Partial<EmomConfig>): EmomConfig {
  const raw = Array.isArray(partial?.exercises) ? partial.exercises : []
  const exercises: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const text = normalizeExerciseText(item)
    if (!text) continue
    exercises.push(text)
    if (exercises.length >= MAX_EXERCISES) break
  }
  const intervalSeconds = asInt(
    partial?.intervalSeconds,
    defaultEmomConfig.intervalSeconds,
    15,
    180,
  )
  const warnSeconds = asInt(
    partial?.warnSeconds,
    defaultEmomConfig.warnSeconds,
    3,
    Math.min(30, intervalSeconds - 2),
  )
  return {
    exercises: exercises.length > 0 ? exercises : [...defaultEmomExercises],
    intervalSeconds,
    totalRounds: asInt(partial?.totalRounds, defaultEmomConfig.totalRounds, 1, 120),
    warnSeconds,
    warnSignal: asSignal(partial?.warnSignal, defaultEmomConfig.warnSignal),
    goSignal: asSignal(partial?.goSignal, defaultEmomConfig.goSignal),
  }
}

export function emomExercise(exercises: string[], round: number) {
  if (exercises.length === 0 || round < 1) return ''
  return exercises[(round - 1) % exercises.length] ?? ''
}

export function moveEmomExercise(exercises: string[], from: number, to: number) {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= exercises.length ||
    to >= exercises.length
  ) {
    return exercises
  }
  const next = [...exercises]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function isRestExercise(text: string) {
  return /^\s*vila\s*$/i.test(text)
}

export function formatEmomClock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
