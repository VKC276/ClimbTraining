import type { GymSnapshot } from '../types'
import { settingsMatchDefaults } from './storage'

/** Pågående nedräkning, pausad timer eller varv som inte får avbrytas av viloläget. */
export function hasLiveSession(snapshot: GymSnapshot, now = Date.now()) {
  const timer = snapshot.timerSession
  if (timer.phase === 'paused') return true
  if (timer.phase === 'running' && timer.phaseEndsAt > now) return true

  const emom = snapshot.emomSession
  if (emom.phase === 'running' && emom.phaseEndsAt > now) return true

  const density = snapshot.densityCircuitSession
  if ((density.phase === 'work' || density.phase === 'rest') && density.phaseEndsAt > now) {
    return true
  }

  const fingerboard = snapshot.fingerboardSession
  if (fingerboard.phase === 'running' && fingerboard.phaseEndsAt > now) return true

  const station = snapshot.stationTrainingSession
  if (station.phase === 'running' && station.phaseEndsAt > now) return true

  const choose = snapshot.choosePathSession
  if (choose.phase === 'running' && choose.endsAt > now) return true

  const hold = snapshot.catchHoldSession
  if ((hold.phase === 'countdown' || hold.phase === 'color') && hold.phaseEndsAt > now) {
    return true
  }

  const technique = snapshot.techniqueFocusSession
  if (technique.frames.length > 0 && technique.endsAt > now) return true

  const doubleRule = snapshot.doubleRuleSession
  if (doubleRule.frames.length > 0 && doubleRule.endsAt > now) return true

  return false
}

/**
 * Första ögonblicksbilden från rummet vinner om den har en pågående aktivitet
 * och den här klienten inte själv just avslutat den.
 */
export function shouldPreferRemoteLive(
  local: GymSnapshot,
  remote: GymSnapshot,
  loaded: GymSnapshot,
) {
  if (!hasLiveSession(remote) || hasLiveSession(local)) return false
  const endedLoadedLive =
    hasLiveSession(loaded) &&
    !hasLiveSession(local) &&
    local.lastInteractionAt > loaded.lastInteractionAt
  return !endedLoadedLive
}

/**
 * Ny tränarklient tar alltid rummet/Pi:n vid första synken, så lokala
 * standardvärden eller gammal cache inte skriver över sparade inställningar.
 * Display får behålla nyare lokal state om den inte är orörd default.
 */
export function shouldAdoptRemoteSnapshot(options: {
  isDisplay: boolean
  local: GymSnapshot
  remote: GymSnapshot
  loaded: GymSnapshot
  firstRemote: boolean
  mutated: boolean
  preferLiveArmed: boolean
}): 'remote-live' | 'remote' | 'keep-local' {
  const { isDisplay, local, remote, loaded, firstRemote, mutated, preferLiveArmed } =
    options

  if (preferLiveArmed && shouldPreferRemoteLive(local, remote, loaded)) {
    return 'remote-live'
  }

  if (firstRemote && !isDisplay && !mutated) {
    return 'remote'
  }

  if (local.lastInteractionAt === 0) return 'remote'

  if (
    firstRemote &&
    !mutated &&
    settingsMatchDefaults(local.settings) &&
    remote.lastInteractionAt > 0
  ) {
    return 'remote'
  }

  if (remote.lastInteractionAt >= local.lastInteractionAt) return 'remote'
  return 'keep-local'
}

/** Seed till rummet: bara egna ändringar, live-pass, eller Pi som återställer sitt state. */
export function shouldSeedRoom(options: {
  isDisplay: boolean
  mutated: boolean
  loaded: GymSnapshot
  current: GymSnapshot
}) {
  const { isDisplay, mutated, loaded, current } = options
  if (mutated) return current.lastInteractionAt > 0
  if (hasLiveSession(current) || hasLiveSession(loaded)) {
    return current.lastInteractionAt > 0
  }
  if (
    isDisplay &&
    loaded.lastInteractionAt > 0 &&
    !settingsMatchDefaults(loaded.settings)
  ) {
    return true
  }
  return false
}
