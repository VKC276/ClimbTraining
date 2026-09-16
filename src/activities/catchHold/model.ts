export type CatchHoldColorId =
  | 'red'
  | 'blue'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'purple'
  | 'pink'
  | 'black'
  | 'white'
  | 'turquoise'
  | 'mint'

export type CatchHoldColor = {
  id: CatchHoldColorId
  name: string
  spokenName: string
  hex: string
}

export const catchHoldColors: CatchHoldColor[] = [
  { id: 'red', name: 'Röd', spokenName: 'röd', hex: '#e53935' },
  { id: 'blue', name: 'Blå', spokenName: 'blå', hex: '#1e88e5' },
  { id: 'yellow', name: 'Gul', spokenName: 'gul', hex: '#fdd835' },
  { id: 'green', name: 'Grön', spokenName: 'grön', hex: '#43a047' },
  { id: 'orange', name: 'Orange', spokenName: 'oransch', hex: '#fb8c00' },
  { id: 'purple', name: 'Lila', spokenName: 'lila', hex: '#8e24aa' },
  { id: 'pink', name: 'Rosa', spokenName: 'råsa', hex: '#ec407a' },
  { id: 'turquoise', name: 'Turkos', spokenName: 'turkås', hex: '#00acc1' },
  { id: 'mint', name: 'Mint', spokenName: 'mint', hex: '#66bb6a' },
  { id: 'black', name: 'Svart', spokenName: 'svart', hex: '#212121' },
  { id: 'white', name: 'Vit', spokenName: 'vit', hex: '#f5f5f5' },
]

export type CatchHoldConfig = {
  colorIds: CatchHoldColorId[]
  countdownSeconds: number
  rounds: number
  betweenRoundsSeconds: number
  soundOn: boolean
}

export type CatchHoldPhase = 'idle' | 'countdown' | 'color' | 'done'

export type CatchHoldSession = {
  phase: CatchHoldPhase
  round: number
  colorId: CatchHoldColorId | null
  phaseEndsAt: number
}

export const defaultCatchHoldConfig: CatchHoldConfig = {
  colorIds: ['red', 'blue', 'yellow', 'green', 'orange', 'purple'],
  countdownSeconds: 6,
  rounds: 8,
  betweenRoundsSeconds: 30,
  soundOn: true,
}

export const idleCatchHoldSession: CatchHoldSession = {
  phase: 'idle',
  round: 0,
  colorId: null,
  phaseEndsAt: 0,
}

export function getCatchHoldColor(id: string | null): CatchHoldColor | undefined {
  if (!id) return undefined
  return catchHoldColors.find((color) => color.id === id)
}

export function isLightHex(hex: string) {
  const value = hex.replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 165
}

export function pickCatchHoldColor(
  colorIds: CatchHoldColorId[],
  previous: CatchHoldColorId | null,
): CatchHoldColorId {
  const enabled = colorIds.length > 0 ? colorIds : defaultCatchHoldConfig.colorIds
  const pool =
    enabled.length > 1 && previous
      ? enabled.filter((id) => id !== previous)
      : enabled
  return pool[Math.floor(Math.random() * pool.length)] ?? enabled[0]
}

function isColorId(value: unknown): value is CatchHoldColorId {
  return catchHoldColors.some((color) => color.id === value)
}

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizeCatchHoldConfig(
  partial?: Partial<CatchHoldConfig>,
): CatchHoldConfig {
  const colorIds = Array.isArray(partial?.colorIds)
    ? partial.colorIds.filter(isColorId)
    : defaultCatchHoldConfig.colorIds
  return {
    colorIds: colorIds.length > 0 ? colorIds : defaultCatchHoldConfig.colorIds,
    countdownSeconds: asInt(
      partial?.countdownSeconds,
      defaultCatchHoldConfig.countdownSeconds,
      1,
      60,
    ),
    rounds: asInt(partial?.rounds, defaultCatchHoldConfig.rounds, 1, 99),
    betweenRoundsSeconds: asInt(
      partial?.betweenRoundsSeconds,
      defaultCatchHoldConfig.betweenRoundsSeconds,
      1,
      300,
    ),
    soundOn: typeof partial?.soundOn === 'boolean' ? partial.soundOn : true,
  }
}
