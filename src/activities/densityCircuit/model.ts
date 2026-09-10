export type DensitySignalId = 'off' | 'beep' | 'double' | 'bell' | 'voice'

export type DensityCircuitConfig = {
  workMinutes: number
  restMinutes: number
  rounds: number
  workEndSignal: DensitySignalId
  restEndSignal: DensitySignalId
}

export type DensityCircuitPhase = 'idle' | 'work' | 'rest' | 'done'

export type DensityCircuitSession = {
  phase: DensityCircuitPhase
  round: number
  phaseEndsAt: number
}

export const densitySignalOptions: {
  id: DensitySignalId
  label: string
  hint: string
}[] = [
  { id: 'off', label: 'Av', hint: 'Ingen signal' },
  { id: 'beep', label: 'Pip', hint: 'Ett tydligt pip' },
  { id: 'double', label: 'Dubbelpip', hint: 'Två toner' },
  { id: 'bell', label: 'Gong', hint: 'Mjuk klang' },
  { id: 'voice', label: 'Röst', hint: 'Säger Vila, Klättra eller Klart' },
]

export const defaultDensityCircuitConfig: DensityCircuitConfig = {
  workMinutes: 4,
  restMinutes: 2,
  rounds: 4,
  workEndSignal: 'beep',
  restEndSignal: 'beep',
}

export const idleDensityCircuitSession: DensityCircuitSession = {
  phase: 'idle',
  round: 0,
  phaseEndsAt: 0,
}

export const workStrategy =
  'Klättra valt problem, klättra ner och börja om vid starten. Repetera så många repetitioner du hinner innan tiden går ut.'

export const restStrategy =
  'Sätt dig ner, skaka ur armarna helt och fokusera på djup bukandning för att rensa mjölksyra.'

export const volumeHint =
  'Du kan köra samma problem alla varv, eller byta problem inför varje nytt arbetsintervall.'

export function volumeStrategy(rounds: number) {
  return `Gör ${rounds} set totalt. ${volumeHint}`
}

export const problemTips = [
  'Gradera ner rejält: välj ett problem cirka 3–4 grader under ditt max (t.ex. V2/5C om ditt max är V6/7A).',
  'Undvik skaderisker: välj ett flackt eller svagt överhängande problem med bra grepp. Slopers och pockets blir snabbt farliga för fingrarna när tröttheten slår till.',
]

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizeDensityCircuitConfig(
  partial?: Partial<DensityCircuitConfig>,
): DensityCircuitConfig {
  return {
    workMinutes: asInt(
      partial?.workMinutes,
      defaultDensityCircuitConfig.workMinutes,
      1,
      30,
    ),
    restMinutes: asInt(
      partial?.restMinutes,
      defaultDensityCircuitConfig.restMinutes,
      1,
      20,
    ),
    rounds: asInt(partial?.rounds, defaultDensityCircuitConfig.rounds, 1, 20),
    workEndSignal: asSignal(
      partial?.workEndSignal,
      defaultDensityCircuitConfig.workEndSignal,
    ),
    restEndSignal: asSignal(
      partial?.restEndSignal,
      defaultDensityCircuitConfig.restEndSignal,
    ),
  }
}

function asSignal(value: unknown, fallback: DensitySignalId): DensitySignalId {
  return densitySignalOptions.some((option) => option.id === value)
    ? (value as DensitySignalId)
    : fallback
}

export function formatPhaseClock(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
