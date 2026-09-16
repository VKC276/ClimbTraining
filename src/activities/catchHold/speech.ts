import { unlockDensityAudio } from '../densityCircuit/signals'
import { PI_HELPER_URL } from '../../gym/displayHardware'
import type { CatchHoldColor, CatchHoldColorId } from './model'

const SOUND_EXTS = ['wav', 'mp3', 'ogg', 'm4a'] as const

function colorSoundUrls(id: CatchHoldColorId) {
  const base = `${import.meta.env.BASE_URL}sounds/catch-hold/${id}`
  return SOUND_EXTS.map((ext) => `${base}.${ext}`)
}

async function playColorFile(id: CatchHoldColorId) {
  for (const url of colorSoundUrls(id)) {
    try {
      const response = await fetch(url)
      if (!response.ok) continue
      const blob = await response.blob()
      if (blob.size < 32) continue
      const objectUrl = URL.createObjectURL(blob)
      try {
        const audio = new Audio(objectUrl)
        audio.preload = 'auto'
        await audio.play()
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener('ended', () => resolve(), { once: true })
          audio.addEventListener('error', () => reject(), { once: true })
        })
        return true
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    } catch {
      // try next extension
    }
  }
  return false
}

async function speakOnPi(color: CatchHoldColor) {
  const response = await fetch(`${PI_HELPER_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ speak: color.spokenName, soundId: color.id }),
  })
  if (!response.ok) throw new Error('Pi-hjälparen svarade inte')
}

export async function announceCatchHoldColor(color: CatchHoldColor) {
  await unlockDensityAudio()
  if (await playColorFile(color.id)) return
  try {
    await speakOnPi(color)
  } catch {
    // helper and espeak-ng exist only on the gym Pi
  }
}
