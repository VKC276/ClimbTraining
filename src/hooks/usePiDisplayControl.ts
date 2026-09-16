import { useEffect, useRef } from 'react'
import {
  PI_HELPER_URL,
  screenScheduledOn,
  type DisplayHardware,
} from '../gym/displayHardware'

function clockKey(now: Date) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

async function pushToPi(hardware: DisplayHardware) {
  const response = await fetch(`${PI_HELPER_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(hardware),
  })
  if (!response.ok) throw new Error('Pi-hjälparen svarade inte')
}

export function usePiDisplayControl(
  hardware: DisplayHardware,
  updateHdmiOn: (hdmiOn: boolean) => void,
) {
  const lastSent = useRef('')
  const lastHdmi = useRef(hardware.hdmiOn)
  const lastScheduleMinute = useRef('')

  useEffect(() => {
    const payload = JSON.stringify(hardware)
    if (payload === lastSent.current) return
    const powerChanged = hardware.hdmiOn !== lastHdmi.current
    lastHdmi.current = hardware.hdmiOn
    const timer = window.setTimeout(
      () => {
        lastSent.current = payload
        void pushToPi(hardware).catch((error) => {
          lastSent.current = ''
          console.warn('Pi-hjälparen nås inte', error)
        })
      },
      powerChanged ? 0 : 500,
    )
    return () => window.clearTimeout(timer)
  }, [hardware])

  useEffect(() => {
    if (!hardware.scheduleEnabled) return

    const tick = () => {
      const now = new Date()
      const minute = clockKey(now)
      if (minute === lastScheduleMinute.current) return
      if (minute !== hardware.onTime && minute !== hardware.offTime) return
      lastScheduleMinute.current = minute
      const shouldOn = screenScheduledOn(now, hardware.onTime, hardware.offTime)
      if (shouldOn !== hardware.hdmiOn) updateHdmiOn(shouldOn)
    }

    tick()
    const id = window.setInterval(tick, 5000)
    return () => window.clearInterval(id)
  }, [
    hardware.scheduleEnabled,
    hardware.onTime,
    hardware.offTime,
    hardware.hdmiOn,
    updateHdmiOn,
  ])
}
