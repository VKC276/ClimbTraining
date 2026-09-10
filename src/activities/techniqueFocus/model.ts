export const defaultTechniqueFocuses = [
  'Bara sidohåll',
  'Ingen flagging',
  'Håll höfterna nära väggen',
  'Statisk rörelse – inga dynos',
]

export type TechniqueFocusConfig = {
  focuses: string[]
}

export type TechniqueFocusSession = {
  frames: string[]
  pick: string
  startedAt: number
  endsAt: number
}

export const defaultTechniqueFocusConfig: TechniqueFocusConfig = {
  focuses: [...defaultTechniqueFocuses],
}

export const idleTechniqueFocusSession: TechniqueFocusSession = {
  frames: [],
  pick: '',
  startedAt: 0,
  endsAt: 0,
}

export const techniqueFocusIntro =
  'Inför varje boulder eller rutt slumpas ett teknikfokus. Gruppen klättrar med den begränsningen tills nästa slump.'

const MAX_FOCUS_LENGTH = 80
const MAX_FOCUSES = 40

export function normalizeFocusText(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_FOCUS_LENGTH)
}

export function normalizeTechniqueFocusConfig(
  partial?: Partial<TechniqueFocusConfig>,
): TechniqueFocusConfig {
  const raw = Array.isArray(partial?.focuses) ? partial.focuses : []
  const focuses: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const text = normalizeFocusText(item)
    if (!text) continue
    if (focuses.some((existing) => existing.toLowerCase() === text.toLowerCase())) {
      continue
    }
    focuses.push(text)
    if (focuses.length >= MAX_FOCUSES) break
  }
  return {
    focuses: focuses.length > 0 ? focuses : [...defaultTechniqueFocuses],
  }
}

export function pickTechniqueFocus(focuses: string[], previous: string) {
  const pool =
    focuses.length > 1 && previous
      ? focuses.filter((item) => item !== previous)
      : focuses
  return pool[Math.floor(Math.random() * pool.length)] ?? focuses[0]
}

export function buildSpinFrames(focuses: string[], pick: string) {
  const pool = focuses.length > 0 ? focuses : [...defaultTechniqueFocuses]
  const winner = pool.includes(pick) ? pick : pool[0]
  const count = Math.max(22, pool.length * 4)
  const frames: string[] = []
  for (let i = 0; i < count - 1; i++) {
    const avoid = frames[i - 1]
    const choices = pool.filter((item) => item !== avoid)
    const next = choices[Math.floor(Math.random() * choices.length)] ?? pool[0]
    frames.push(next)
  }
  frames.push(winner)
  return frames
}

export function spinIndex(startedAt: number, endsAt: number, now: number, count: number) {
  if (count <= 1) return 0
  const duration = Math.max(1, endsAt - startedAt)
  const t = Math.min(1, Math.max(0, (now - startedAt) / duration))
  const eased = 1 - (1 - t) ** 3
  return Math.min(count - 1, Math.floor(eased * count))
}

export function visibleTechniqueFocus(
  session: TechniqueFocusSession,
  now: number,
) {
  if (session.frames.length === 0) return session.pick
  if (now >= session.endsAt) return session.pick || session.frames.at(-1) || ''
  const index = spinIndex(
    session.startedAt,
    session.endsAt,
    now,
    session.frames.length,
  )
  return session.frames[index] ?? session.pick
}

export const SPIN_DURATION_MS = 4200
