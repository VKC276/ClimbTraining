import { playCueTone, unlockDensityAudio } from '../densityCircuit/signals'
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

export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  synth.getVoices()
  synth.resume()
  if (synth.speaking || synth.pending) return
  const warm = new SpeechSynthesisUtterance(' ')
  warm.volume = 0
  warm.rate = 2
  warm.lang = 'sv-SE'
  try {
    synth.speak(warm)
  } catch {
    // Chromium can reject speech until a gesture
  }
}

function speakColorName(name: string) {
  if (!('speechSynthesis' in window)) return

  const synth = window.speechSynthesis
  const speak = () => {
    const utter = new SpeechSynthesisUtterance(`${name}!`)
    utter.lang = 'sv-SE'
    utter.rate = 1.05
    utter.pitch = 1.05
    utter.volume = 1
    const voice =
      synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('sv')) ??
      synth.getVoices().find((item) => item.lang.toLowerCase().startsWith('en'))
    if (voice) utter.voice = voice
    synth.resume()
    synth.speak(utter)
  }

  synth.cancel()
  window.setTimeout(speak, 80)
  if (synth.getVoices().length === 0) {
    synth.addEventListener('voiceschanged', speak, { once: true })
  }
}

export async function announceCatchHoldColor(color: CatchHoldColor) {
  await unlockDensityAudio()
  unlockSpeech()
  await playCueTone(colorTones[color.id] ?? 523)
  speakColorName(color.name)
}
