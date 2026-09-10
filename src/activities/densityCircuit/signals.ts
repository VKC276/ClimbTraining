import type { DensitySignalId } from './model'

let audioCtx: AudioContext | null = null
let keepAlive: OscillatorNode | null = null
let holdAudio: HTMLAudioElement | null = null
const activeNodes: AudioScheduledSourceNode[] = []

function AudioContextCtor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  )
}

function getAudioContext() {
  if (!audioCtx) {
    const Ctor = AudioContextCtor()
    if (!Ctor) throw new Error('Web Audio saknas i webbläsaren')
    audioCtx = new Ctor()
  }
  return audioCtx
}

export async function unlockDensityAudio() {
  if (typeof window === 'undefined' || !AudioContextCtor()) return
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  if (ctx.state === 'running' && !keepAlive) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.frequency.value = 40
    amp.gain.value = 0.00001
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start()
    keepAlive = osc
  }
  if (!holdAudio) {
    holdAudio = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
    )
    holdAudio.loop = true
    holdAudio.volume = 0.0001
  }
  try {
    await holdAudio.play()
  } catch {
    // needs a user gesture on this device
  }
}

function stopActiveNodes() {
  for (const node of activeNodes) {
    try {
      node.stop()
    } catch {
      // already stopped
    }
    try {
      node.disconnect()
    } catch {
      // already disconnected
    }
  }
  activeNodes.length = 0
}

function track(node: AudioScheduledSourceNode) {
  activeNodes.push(node)
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
) {
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, start)
  amp.gain.setValueAtTime(0, start)
  amp.gain.linearRampToValueAtTime(gain, start + 0.02)
  amp.gain.setValueAtTime(gain, start + Math.max(0.06, duration - 0.08))
  amp.gain.linearRampToValueAtTime(0, start + duration)
  osc.connect(amp)
  amp.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
  track(osc)
}

function playGong(ctx: AudioContext, start: number) {
  const freqs = [196, 247, 392, 587]
  for (const [index, freq] of freqs.entries()) {
    const osc = ctx.createOscillator()
    const amp = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)
    const peak = 0.22 - index * 0.035
    amp.gain.setValueAtTime(0, start)
    amp.gain.linearRampToValueAtTime(peak, start + 0.04)
    amp.gain.exponentialRampToValueAtTime(0.001, start + 2.2)
    osc.connect(amp)
    amp.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 2.3)
    track(osc)
  }
}

function speakPhrase(text: string) {
  if (!('speechSynthesis' in window)) return
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'sv-SE'
  utter.rate = 0.95
  utter.pitch = 1
  utter.volume = 1
  const voice = window.speechSynthesis
    .getVoices()
    .find((item) => item.lang.toLowerCase().startsWith('sv'))
  if (voice) utter.voice = voice
  window.speechSynthesis.speak(utter)
}

export type DensitySignalPhrase = 'vila' | 'klättra' | 'klart' | 'byt' | 'go' | 'varning'

export async function playDensitySignal(
  id: DensitySignalId,
  phrase: DensitySignalPhrase,
) {
  if (id === 'off') return

  if (id === 'voice') {
    const spoken =
      phrase === 'vila'
        ? 'Vila'
        : phrase === 'klättra'
          ? 'Klättra'
          : phrase === 'byt'
            ? 'Byt station'
            : phrase === 'go'
              ? 'Kör'
              : phrase === 'varning'
                ? 'Tio sekunder'
                : 'Klart'
    speakPhrase(spoken)
    return
  }

  const ctx = getAudioContext()
  if (ctx.state === 'suspended') await ctx.resume()
  stopActiveNodes()
  const t = ctx.currentTime + 0.03

  if (id === 'beep') {
    playTone(ctx, 880, t, 0.7, 'sine', 0.32)
    return
  }

  if (id === 'double') {
    playTone(ctx, 740, t, 0.16, 'square', 0.24)
    playTone(ctx, 740, t + 0.28, 0.16, 'square', 0.24)
    playTone(ctx, 980, t + 0.56, 0.45, 'square', 0.26)
    return
  }

  playGong(ctx, t)
}
