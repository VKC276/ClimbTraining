import type { Activity } from './types'

export const activities: Activity[] = [
  {
    id: 'timer',
    title: 'Timer',
    description: 'Stor nedräkning på gymskärmen. Välj tid, starta och pausa.',
    status: 'ready',
  },
  {
    id: 'catch-hold',
    title: 'Catch a hold',
    description: 'Nedräkning och slumpad greppfärg. Fånga rätt färg!',
    status: 'ready',
  },
  {
    id: 'density-circuit',
    title: 'Density circuit',
    description: '4 min klättra, 2 min vila, 4 varv. Volym på valt problem.',
    status: 'ready',
  },
  {
    id: 'station-training',
    title: 'Stationsträning',
    description:
      'Gemensam nedräkning så en grupp kan rotera mellan stationer.',
    status: 'ready',
  },
  {
    id: 'technique-focus',
    title: 'Teknikfokus-slumpare',
    description:
      'Slumpar ett teknikfokus inför varje boulder eller rutt.',
    status: 'ready',
  },
  {
    id: 'emom',
    title: 'EMOM',
    description:
      'Every Minute on the Minute. Övning, nedräkning och rundor på skärmen.',
    status: 'ready',
  },
  {
    id: 'choose-path',
    title: 'Choose your path',
    description:
      'Berättelsedriven klättring för barn. Stigande lava i stället för siffror.',
    status: 'ready',
  },
  {
    id: 'fingerboard',
    title: 'Fingerboard',
    description:
      'Klassiska repeaters. Ställ in häng, vila, reps och set, så räknar skärmen.',
    status: 'ready',
  },
  {
    id: 'campus',
    title: 'Campus',
    description: 'Steg, lock-offs och power på campusbräda.',
    status: 'soon',
  },
  {
    id: 'cirkel',
    title: 'Cirkelträning',
    description: 'Bouldercirklar med tid och vila på storskärm.',
    status: 'soon',
  },
  {
    id: 'core',
    title: 'Core',
    description: 'Bålpass med tydliga intervaller för hallen.',
    status: 'soon',
  },
  {
    id: 'antagonist',
    title: 'Antagonister',
    description: 'Skulder, armbåge och underarm för balanserad träning.',
    status: 'soon',
  },
]

export function getActivity(id: string | null): Activity | undefined {
  if (!id) return undefined
  return activities.find((activity) => activity.id === id)
}
