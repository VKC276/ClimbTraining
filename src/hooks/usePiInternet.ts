import { PI_HELPER_URL } from '../gym/displayHardware'
import { useEffect, useState } from 'react'

export function usePiInternet() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    let stopped = false

    const tick = async () => {
      try {
        const response = await fetch(`${PI_HELPER_URL}/health`)
        if (!response.ok) return
        const payload = (await response.json()) as { internet?: boolean }
        if (!stopped) setOnline(payload.internet !== false)
      } catch {
        /* Hjälparen nås inte — det är inte samma sak som saknat internet. */
      }
    }

    void tick()
    const id = window.setInterval(() => {
      void tick()
    }, 5000)
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [])

  return online
}
