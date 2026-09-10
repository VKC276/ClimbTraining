import type { DensitySignalId } from '../densityCircuit/model'
import { densitySignalOptions } from '../densityCircuit/model'

export type { DensitySignalId }

export type StationTrainingConfig = {
  stationMinutes: number
  stationSeconds: number
  switchSignal: DensitySignalId
}

export type StationTrainingPhase = 'idle' | 'running'

export type StationTrainingSession = {
  phase: StationTrainingPhase
  station: number
  phaseEndsAt: number
}

export const defaultStationTrainingConfig: StationTrainingConfig = {
  stationMinutes: 4,
  stationSeconds: 0,
  switchSignal: 'beep',
}

export const idleStationTrainingSession: StationTrainingSession = {
  phase: 'idle',
  station: 0,
  phaseEndsAt: 0,
}

export const stationTrainingIntro =
  'För flera klättrare samtidigt. Skärmen visar en gemensam nedräkning så gruppen kan rotera mellan stationer utan egen klocka.'

export const stationTrainingExamples =
  'På en vägg kan ni till exempel ha tysta fötter och på en annan sticky hands.'

export { densitySignalOptions }

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function asSignal(value: unknown, fallback: DensitySignalId): DensitySignalId {
  return densitySignalOptions.some((option) => option.id === value)
    ? (value as DensitySignalId)
    : fallback
}

export function normalizeStationTrainingConfig(
  partial?: Partial<StationTrainingConfig>,
): StationTrainingConfig {
  const config = {
    stationMinutes: asInt(
      partial?.stationMinutes,
      defaultStationTrainingConfig.stationMinutes,
      0,
      60,
    ),
    stationSeconds: asInt(
      partial?.stationSeconds,
      defaultStationTrainingConfig.stationSeconds,
      0,
      59,
    ),
    switchSignal: asSignal(
      partial?.switchSignal,
      defaultStationTrainingConfig.switchSignal,
    ),
  }
  if (config.stationMinutes === 0 && config.stationSeconds < 15) {
    config.stationSeconds = 15
  }
  return config
}

export function stationDurationMs(config: StationTrainingConfig) {
  return (config.stationMinutes * 60 + config.stationSeconds) * 1000
}

export function formatStationClock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
