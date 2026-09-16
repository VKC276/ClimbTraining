import { playCueTone, unlockDensityAudio } from '../densityCircuit/signals'
import { PI_HELPER_URL } from '../../gym/displayHardware'
import type { CatchHoldColor } from './model'

const colorTones: Record<string, number> = {
  red: 392,
  blue: 494,
  yellow: 587,
  green: 523,
  orange: 440,
  purple: 349,
  pink: 698,
  turquoise: 622,
  black: 196,
  white: 784,
}

async function speakOnPi(name: string) {
  const response = await fetch(`${PI_HELPER_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ speak: name }),
  })
  if (!response.ok) throw new Error('Pi-hjälparen svarade inte')
}

export async function announceCatchHoldColor(color: CatchHoldColor) {
  await unlockDensityAudio()
  await playCueTone(colorTones[color.id] ?? 523)
  try {
    await speakOnPi(color.name)
  } catch {
    // helper and espeak-ng exist only on the gym Pi
  }
}
