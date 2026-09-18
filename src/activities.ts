import type { Activity } from './types'

export const activities: Activity[] = [
  {
    id: 'timer',
    title: 'Timer',
    description: 'Stor nedräkning på gymskärmen. Välj tid, starta och pausa.',
  },
  {
    id: 'catch-hold',
    title: 'Catch a hold',
    description: 'Nedräkning och slumpad greppfärg. Fånga rätt färg!',
  },
  {
    id: 'density-circuit',
    title: 'Density circuit',
    description: '4 min klättra, 2 min vila, 4 varv. Volym på valt problem.',
  },
  {
    id: 'station-training',
    title: 'Stationsträning',
    description:
      'Gemensam nedräkning så en grupp kan rotera mellan stationer.',
  },
  {
    id: 'technique-focus',
    title: 'Teknikfokus-slumpare',
    description:
      'Slumpar ett teknikfokus inför varje boulder eller rutt.',
  },
  {
    id: 'emom',
    title: 'EMOM',
    description:
      'Every Minute on the Minute. Övning, nedräkning och rundor på skärmen.',
  },
  {
    id: 'choose-path',
    title: 'Floor is lava',
    description:
      'Stigande lava på tiden ni ställer in. Hinna klart innan den kommer ikapp.',
  },
  {
    id: 'fingerboard',
    title: 'Fingerboard',
    description:
      'Klassiska repeaters. Ställ in häng, vila, reps och set, så räknar skärmen.',
  },
  {
    id: 'dubbelregeln',
    title: 'Dubbelregeln',
    description:
      'Två kort på skärmen. Samma kategori ersätter, den andra läggs bredvid.',
  },
]

export function getActivity(id: string | null): Activity | undefined {
  if (!id) return undefined
  return activities.find((activity) => activity.id === id)
}
