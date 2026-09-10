export const DEVICE_ID_STORAGE = 'vvk-gym-device-id'
export const SCREEN_ID_SESSION = 'vvk-gym-screen-session'

export const SCREEN_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function isDisplayPath(pathname = window.location.pathname) {
  return pathname.replace(/\/+$/, '') === '/display'
}

export function normalizeScreenId(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
}

export function isScreenId(value: string) {
  return /^[A-Z0-9]{4}$/.test(value)
}

export function isDeviceId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

export function ensureDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE)?.trim() ?? ''
  if (isDeviceId(existing)) return existing
  const next = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_ID_STORAGE, next)
  return next
}

export function readTrainerScreenId() {
  const stored = normalizeScreenId(window.sessionStorage.getItem(SCREEN_ID_SESSION) ?? '')
  return isScreenId(stored) ? stored : null
}

export function saveTrainerScreenId(id: string) {
  window.sessionStorage.setItem(SCREEN_ID_SESSION, id)
}

export function clearTrainerScreenId() {
  window.sessionStorage.removeItem(SCREEN_ID_SESSION)
}
