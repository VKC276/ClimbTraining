export function speakColorName(name: string) {
  if (!('speechSynthesis' in window)) return

  const utter = new SpeechSynthesisUtterance(`${name}!`)
  utter.lang = 'sv-SE'
  utter.rate = 1.05
  utter.pitch = 1.05
  const voice = window.speechSynthesis
    .getVoices()
    .find((item) => item.lang.toLowerCase().startsWith('sv'))
  if (voice) utter.voice = voice
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}
