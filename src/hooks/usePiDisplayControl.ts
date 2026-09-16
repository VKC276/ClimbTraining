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

async function readPiVolume() {
  const response = await fetch(`${PI_HELPER_URL}/health`)
  if (!response.ok) throw new Error('Pi-hjälparen svarade inte')
  const data = (await response.json()) as { volume?: number }
  const volume = Math.round(Number(data.volume))
  if (!Number.isFinite(volume)) return null
  return Math.min(100, Math.max(0, volume))
}

export function usePiDisplayControl(
  hardware: DisplayHardware,
  updateHdmiOn: (hdmiOn: boolean) => void,
  updateVolume: (volume: number) => void,
) {
  const lastSent = useRef('')
  const lastHdmi = useRef(hardware.hdmiOn)
  const lastCommandId = useRef(hardware.hdmiCommandId)
  const lastVolume = useRef(hardware.volume)
  const lastLocalVolumeAt = useRef(0)
  const lastScheduleMinute = useRef('')
  const hdmiOnRef = useRef(hardware.hdmiOn)
  const volumeRef = useRef(hardware.volume)
  const updateHdmiOnRef = useRef(updateHdmiOn)
  const updateVolumeRef = useRef(updateVolume)
  hdmiOnRef.current = hardware.hdmiOn
  volumeRef.current = hardware.volume
  updateHdmiOnRef.current = updateHdmiOn
  updateVolumeRef.current = updateVolume

  useEffect(() => {
    const payload = JSON.stringify(hardware)
    if (payload === lastSent.current) return
    if (hardware.volume !== lastVolume.current) lastLocalVolumeAt.current = Date.now()
    const powerChanged =
      hardware.hdmiOn !== lastHdmi.current ||
      hardware.hdmiCommandId !== lastCommandId.current
    lastHdmi.current = hardware.hdmiOn
    lastCommandId.current = hardware.hdmiCommandId
    lastVolume.current = hardware.volume
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
    const tick = () => {
      if (Date.now() - lastLocalVolumeAt.current < 4000) return
      void readPiVolume()
        .then((volume) => {
          if (volume === null || volume === volumeRef.current) return
          updateVolumeRef.current(volume)
        })
        .catch(() => {
          // helper exists only on the gym Pi
        })
    }
    tick()
    const id = window.setInterval(tick, 8000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!hardware.scheduleEnabled) return
    const shouldOn = screenScheduledOn(
      new Date(),
      hardware.onTime,
      hardware.offTime,
    )
    if (shouldOn !== hdmiOnRef.current) updateHdmiOnRef.current(shouldOn)
  }, [hardware.scheduleEnabled, hardware.onTime, hardware.offTime])

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
