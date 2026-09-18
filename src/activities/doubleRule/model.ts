export type TwoCardCategory = 1 | 2

export type TwoCard = {
  title: string
  text: string
}

export type TwoCardItem = TwoCard & {
  category: TwoCardCategory
}

export type DoubleRuleConfig = {
  category1Name: string
  category2Name: string
  category1: TwoCard[]
  category2: TwoCard[]
}

export type DoubleRuleSession = {
  remaining: TwoCardItem[]
  slot1: TwoCardItem | null
  slot2: TwoCardItem | null
  lastCategory: TwoCardCategory | null
}

export const defaultBreakCards: TwoCard[] = [
  {
    title: 'Toes Only',
    text: 'Använd bara tårna när du använder fötterna (inga hälar, inga fotvalv).',
  },
  {
    title: 'No Adjusting',
    text: 'När du har tagit tag i ett grepp eller placerat en fot får du inte justera eller flytta handen eller foten.',
  },
  {
    title: 'Silent Climb',
    text: 'Inget prat eller ljud tillåtet under klättringen.',
  },
  {
    title: 'Tripod',
    text: 'Max 3 kontaktpunkter samtidigt.',
  },
  {
    title: 'No Hips',
    text: 'Håll höfterna vinkelrätt mot väggen hela tiden (ingen sidledsposition).',
  },
  {
    title: 'Invisible Chair',
    text: 'Inga raka ben under klättringen.',
  },
  {
    title: 'Flag Every Move',
    text: 'Du måste flagga (sträck ut ett ben åt sidan eller bakåt för balans) vid varje handrörelse.',
  },
  {
    title: 'No Edges',
    text: 'Använd inte skons yttre kant (varken tå- eller häl-kanten) mot väggen för balans.',
  },
  {
    title: 'No Soles',
    text: 'Tryck inte fotsulorna mot väggen för friktion.',
  },
  {
    title: 'Peace!',
    text: 'Endast 2 fingrar per hand får vara i kontakt med ett grepp åt gången.',
  },
  {
    title: 'Hand-emies',
    text: 'Ingen handmatchning på grepp.',
  },
  {
    title: 'Foot-emies',
    text: 'Ingen fotmatchning på grepp.',
  },
  {
    title: 'Poisonous Foot',
    text: 'När en fot har rört ett grepp får den inte användas där igen av en fot.',
  },
  {
    title: 'Poisonous Hand',
    text: 'När en hand har rört ett grepp får den inte användas där igen av en hand.',
  },
  {
    title: 'Hand Besties',
    text: 'Varje användning av en hand på ett grepp måste följas av den andra handen innan du går vidare.',
  },
  {
    title: 'Foot Besties',
    text: 'Varje användning av en fot på ett grepp måste följas av den andra foten innan du går vidare.',
  },
  {
    title: 'Crosses Only',
    text: 'Använd endast kryssande handrörelser (vänster över/under höger, höger över/under vänster) för handrörelser.',
  },
  {
    title: 'Disposable Thumbs',
    text: 'Inga klämgrepp... det betyder att du inte får använda tummen för grepp.',
  },
  {
    title: 'Newb',
    text: 'Använd inte tårna... det betyder att du bara får använda hälar och fotvalv.',
  },
  {
    title: 'T-rex',
    text: 'Inga raka armbågar under klättringen.',
  },
]

export const defaultBetaCards: TwoCard[] = [
  {
    title: 'High Step',
    text: 'Slutför minst 1 rörelse genom att placera en fot ovanför midjehöjd.',
  },
  {
    title: 'Dyno Required',
    text: 'Slutför minst 1 hopprörelse.',
  },
  {
    title: 'Gaston Required',
    text: 'Använd ett gaston-grepp (ta tag med tummen nedåt och dra utåt) för att slutföra minst 1 rörelse.',
  },
  {
    title: 'Heel Hook',
    text: 'Använd en hälkrok för att slutföra minst 1 rörelse.',
  },
  {
    title: 'Legs Crossed',
    text: 'Slutför minst 1 rörelse genom att korsa ett ben över det andra.',
  },
  {
    title: 'Toe Hook',
    text: 'Använd en tåkrok för att slutföra minst 1 rörelse.',
  },
  {
    title: 'Drop Knee',
    text: 'Använd en Drop Knee för att slutföra minst 1 rörelse.',
  },
  {
    title: 'Downclimb',
    text: 'Inget hopp ner till marken. Beta- och Break-kort kan ignoreras under nedklättringen.',
  },
  {
    title: 'Palm Press',
    text: 'Använd ett handflatstryck (pressa handflatan mot ett grepp eller en yta för stabilitet) för att slutföra minst 1 rörelse.',
  },
  {
    title: 'Straight Arms',
    text: 'Slutför minst 1 rörelse med båda armarna raka.',
  },
  {
    title: 'Deadpoint',
    text: 'Slutför minst 1 rörelse med en snabb, dynamisk sträckning till nästa grepp, utan paus, med en fot kvar på väggen.',
  },
  {
    title: 'Footswap',
    text: 'Byt fot mot den andra foten på samma grepp utan att lyfta båda fötterna från väggen.',
  },
  {
    title: 'Bicycle',
    text: 'Använd en cykel (kläm ett grepp mellan ovansidan av en fot och undersidan av den andra foten) för att slutföra minst 1 rörelse.',
  },
  {
    title: 'Rockover',
    text: 'Slutför minst 1 rörelse genom att flytta tyngden över en hög fot.',
  },
  {
    title: 'Pogo',
    text: 'Slutför minst 1 rörelse genom att dynamiskt svinga ett ben för att skapa uppåtgående fart.',
  },
  {
    title: 'Double Smear',
    text: 'Slutför minst 1 rörelse genom att pressa båda fotsulorna mot väggen för friktion.',
  },
  {
    title: 'Straight Right Arm',
    text: 'Slutför minst 1 handrörelse utan att böja höger armbåge.',
  },
  {
    title: 'Straight Left Arm',
    text: 'Slutför minst 1 handrörelse utan att böja vänster armbåge.',
  },
  {
    title: 'Hand Bump',
    text: 'Slutför minst 1 handrörelse genom att flytta en handplacering från ett tillfälligt grepp till dess optimala grepp.',
  },
  {
    title: 'Foot Bump',
    text: 'Slutför minst 1 fotrörelse genom att flytta en fotplacering från ett tillfälligt grepp till dess optimala grepp.',
  },
]

export const defaultDoubleRuleConfig: DoubleRuleConfig = {
  category1Name: 'Break',
  category2Name: 'Beta',
  category1: defaultBreakCards,
  category2: defaultBetaCards,
}

export const idleDoubleRuleSession: DoubleRuleSession = {
  remaining: [],
  slot1: null,
  slot2: null,
  lastCategory: null,
}

export const doubleRuleIntro =
  'Alla kort ligger i samma lek. Dra ett kort: samma kategori ersätter det aktiva kortet, den andra kategorin läggs bredvid. Bara ett Break och ett Beta syns åt gången.'

const MAX_TITLE = 40
const MAX_TEXT = 220
const MAX_CARDS = 40

function normalizeCard(value: unknown): TwoCard | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { title?: unknown; text?: unknown }
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, MAX_TITLE) : ''
  const text = typeof raw.text === 'string' ? raw.text.trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT) : ''
  if (!title) return null
  return { title, text }
}

function normalizeCards(raw: unknown, fallback: TwoCard[]): TwoCard[] {
  if (!Array.isArray(raw)) return fallback.map((card) => ({ ...card }))
  const cards: TwoCard[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const card = normalizeCard(item)
    if (!card) continue
    const key = card.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cards.push(card)
    if (cards.length >= MAX_CARDS) break
  }
  return cards.length > 0 ? cards : fallback.map((card) => ({ ...card }))
}

function normalizeName(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 24) : fallback
}

export function normalizeDoubleRuleConfig(
  partial?: Partial<DoubleRuleConfig>,
): DoubleRuleConfig {
  return {
    category1Name: normalizeName(partial?.category1Name, defaultDoubleRuleConfig.category1Name),
    category2Name: normalizeName(partial?.category2Name, defaultDoubleRuleConfig.category2Name),
    category1: normalizeCards(partial?.category1, defaultBreakCards),
    category2: normalizeCards(partial?.category2, defaultBetaCards),
  }
}

function normalizeItem(value: unknown): TwoCardItem | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as { category?: unknown }
  const card = normalizeCard(value)
  if (!card) return null
  const category = raw.category === 2 ? 2 : raw.category === 1 ? 1 : null
  if (!category) return null
  return { ...card, category }
}

export function normalizeDoubleRuleSession(
  partial?: Partial<DoubleRuleSession>,
): DoubleRuleSession {
  const remaining = Array.isArray(partial?.remaining)
    ? partial.remaining.map(normalizeItem).filter((item): item is TwoCardItem => Boolean(item))
    : []
  const last =
    partial?.lastCategory === 1 || partial?.lastCategory === 2 ? partial.lastCategory : null
  return {
    remaining,
    slot1: normalizeItem(partial?.slot1),
    slot2: normalizeItem(partial?.slot2),
    lastCategory: last,
  }
}

export function shuffleDeck(config: DoubleRuleConfig): TwoCardItem[] {
  const cards: TwoCardItem[] = [
    ...config.category1.map((card) => ({ ...card, category: 1 as const })),
    ...config.category2.map((card) => ({ ...card, category: 2 as const })),
  ]
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = cards[i]
    cards[i] = cards[j]
    cards[j] = swap
  }
  return cards
}

export function drawDoubleRuleCard(
  session: DoubleRuleSession,
  config: DoubleRuleConfig,
): DoubleRuleSession {
  const remaining =
    session.remaining.length > 0 ? [...session.remaining] : shuffleDeck(config)
  const drawn = remaining.shift()
  if (!drawn) return session
  return {
    remaining,
    slot1: drawn.category === 1 ? drawn : session.slot1,
    slot2: drawn.category === 2 ? drawn : session.slot2,
    lastCategory: drawn.category,
  }
}
