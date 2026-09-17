export type ChoosePathConfig = {
  seconds: number
}

export type ChoosePathSession = {
  phase: 'idle' | 'running' | 'escaped' | 'caught'
  startedAt: number
  endsAt: number
}

export const defaultChoosePathConfig: ChoosePathConfig = {
  seconds: 45,
}

export const idleChoosePathSession: ChoosePathSession = {
  phase: 'idle',
  startedAt: 0,
  endsAt: 0,
}

export const choosePathIntro =
  'Golvet är lava. Ställ in tiden, starta, och lavan stiger mot toppen. Hinna klart innan den kommer ikapp.'

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizeChoosePathConfig(
  partial?: Partial<ChoosePathConfig> & { stories?: { seconds?: unknown }[] },
): ChoosePathConfig {
  const fromStories = Array.isArray(partial?.stories)
    ? partial.stories[0]?.seconds
    : undefined
  return {
    seconds: asInt(partial?.seconds ?? fromStories, defaultChoosePathConfig.seconds, 10, 300),
  }
}

export function normalizeChoosePathSession(
  partial?: Partial<ChoosePathSession> & { phase?: string },
): ChoosePathSession {
  const phase =
    partial?.phase === 'running' ||
    partial?.phase === 'escaped' ||
    partial?.phase === 'caught'
      ? partial.phase
      : 'idle'
  return {
    phase,
    startedAt: asInt(partial?.startedAt, 0, 0, Number.MAX_SAFE_INTEGER),
    endsAt: asInt(partial?.endsAt, 0, 0, Number.MAX_SAFE_INTEGER),
  }
}

export function lavaProgress(startedAt: number, endsAt: number, now: number) {
  const duration = Math.max(1, endsAt - startedAt)
  return Math.min(1, Math.max(0, (now - startedAt) / duration))
}

export function formatChooseClock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
