export type ChoosePathStory = {
  id: string
  title: string
  story: string
  seconds: number
}

export type ChoosePathConfig = {
  stories: ChoosePathStory[]
}

export type ChoosePathSession = {
  phase: 'idle' | 'choose' | 'running' | 'escaped' | 'caught'
  storyId: string
  pathAId: string
  pathBId: string
  startedAt: number
  endsAt: number
}

export const defaultChoosePathStories: ChoosePathStory[] = [
  {
    id: 'lava',
    title: 'Flykten från lavan',
    story:
      'Du är på flykt från lava som stiger – nå toppen innan den kommer ikapp!',
    seconds: 45,
  },
  {
    id: 'dragon',
    title: 'Drakens grotta',
    story:
      'Draken vaknar längst inne i berget. Klättra ut i ljuset innan elden når dig!',
    seconds: 50,
  },
  {
    id: 'bridge',
    title: 'Bron som rasar',
    story:
      'Skatten glimmar på toppen. Hinna dit innan bron bakom dig ramlar sönder!',
    seconds: 40,
  },
  {
    id: 'flood',
    title: 'Den stigande floden',
    story:
      'Vattnet fyller kanjonen. Nå den trygga hyllan däruppe innan vågen tar dig!',
    seconds: 50,
  },
]

export const defaultChoosePathConfig: ChoosePathConfig = {
  stories: defaultChoosePathStories.map((story) => ({ ...story })),
}

export const idleChoosePathSession: ChoosePathSession = {
  phase: 'idle',
  storyId: '',
  pathAId: '',
  pathBId: '',
  startedAt: 0,
  endsAt: 0,
}

export const choosePathIntro =
  'Berättelsedriven klättring för barn. Skärmen visar ett kort scenario och tiden blir stigande lava – ingen siffra, bara inlevelse. Klättraren ska hinna klart rutten innan lavan kommer ikapp.'

const MAX_TITLE = 48
const MAX_STORY = 180
const MAX_STORIES = 24

function asInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function normalizeStoryText(value: string, max: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

export function createStoryId() {
  return `story-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
}

export function normalizeChoosePathConfig(
  partial?: Partial<ChoosePathConfig>,
): ChoosePathConfig {
  const raw = Array.isArray(partial?.stories) ? partial.stories : []
  const stories: ChoosePathStory[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const title = normalizeStoryText(String(item.title ?? ''), MAX_TITLE)
    const story = normalizeStoryText(String(item.story ?? ''), MAX_STORY)
    if (!title || !story) continue
    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim().slice(0, 40)
        : createStoryId()
    if (stories.some((existing) => existing.id === id)) continue
    stories.push({
      id,
      title,
      story,
      seconds: asInt(item.seconds, 45, 15, 180),
    })
    if (stories.length >= MAX_STORIES) break
  }
  return {
    stories:
      stories.length > 0
        ? stories
        : defaultChoosePathStories.map((story) => ({ ...story })),
  }
}

export function getStory(stories: ChoosePathStory[], id: string) {
  return stories.find((story) => story.id === id)
}

export function pickTwoPaths(stories: ChoosePathStory[], avoidId = '') {
  const pool = stories.length > 1 ? stories.filter((story) => story.id !== avoidId) : stories
  if (pool.length === 0) return { pathAId: '', pathBId: '' }
  if (pool.length === 1) return { pathAId: pool[0].id, pathBId: pool[0].id }
  const first = pool[Math.floor(Math.random() * pool.length)]
  const rest = pool.filter((story) => story.id !== first.id)
  const second = rest[Math.floor(Math.random() * rest.length)] ?? first
  return { pathAId: first.id, pathBId: second.id }
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
