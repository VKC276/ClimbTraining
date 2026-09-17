import { normalizeCatchHoldConfig } from '../activities/catchHold/model'
import { idleCatchHoldSession } from '../activities/catchHold/model'
import { normalizeDensityCircuitConfig } from '../activities/densityCircuit/model'
import { idleDensityCircuitSession } from '../activities/densityCircuit/model'
import { normalizeStationTrainingConfig } from '../activities/stationTraining/model'
import { idleStationTrainingSession } from '../activities/stationTraining/model'
import { normalizeTechniqueFocusConfig } from '../activities/techniqueFocus/model'
import { idleTechniqueFocusSession } from '../activities/techniqueFocus/model'
import { normalizeEmomConfig } from '../activities/emom/model'
import { idleEmomSession } from '../activities/emom/model'
import {
  idleChoosePathSession,
  normalizeChoosePathConfig,
  normalizeChoosePathSession,
} from '../activities/choosePath/model'
import { normalizeFingerboardConfig } from '../activities/fingerboard/model'
import { idleFingerboardSession } from '../activities/fingerboard/model'
import { normalizeTimerConfig } from '../activities/timer/model'
import { idleTimerSession } from '../activities/timer/model'
import type { GymSettings, GymSnapshot } from '../types'
import { isFontId } from '../fonts'
import { normalizeDisplayHardware } from './displayHardware'
import {
  SNAPSHOT_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  defaultSnapshot,
  clampIdleSize,
} from './defaults'

function isClockStyle(value: unknown): value is GymSettings['clockStyle'] {
  return value === 'analog' || value === 'digital'
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeSettings(partial?: Partial<GymSettings>): GymSettings {
  return {
    clockStyle: isClockStyle(partial?.clockStyle)
      ? partial.clockStyle
      : defaultSettings.clockStyle,
    idleTimeoutMinutes: asFiniteNumber(
      partial?.idleTimeoutMinutes,
      defaultSettings.idleTimeoutMinutes,
    ),
    idleLogoSize: clampIdleSize(
      asFiniteNumber(
        partial?.idleLogoSize ?? (partial as { displayZoom?: number })?.displayZoom,
        defaultSettings.idleLogoSize,
      ),
    ),
    idleClockSize: clampIdleSize(
      asFiniteNumber(
        partial?.idleClockSize ?? (partial as { displayZoom?: number })?.displayZoom,
        defaultSettings.idleClockSize,
      ),
    ),
    idleScreenIdSize: clampIdleSize(
      asFiniteNumber(partial?.idleScreenIdSize, defaultSettings.idleScreenIdSize),
    ),
    syncRoom:
      typeof partial?.syncRoom === 'string' && partial.syncRoom.trim()
        ? partial.syncRoom.trim()
        : defaultSettings.syncRoom,
    fontId: isFontId(partial?.fontId) ? partial.fontId : defaultSettings.fontId,
    displayHardware: normalizeDisplayHardware(partial?.displayHardware),
    catchHold: normalizeCatchHoldConfig(partial?.catchHold),
    densityCircuit: normalizeDensityCircuitConfig(partial?.densityCircuit),
    stationTraining: normalizeStationTrainingConfig(partial?.stationTraining),
    techniqueFocus: normalizeTechniqueFocusConfig(partial?.techniqueFocus),
    emom: normalizeEmomConfig(partial?.emom),
    choosePath: normalizeChoosePathConfig(partial?.choosePath),
    fingerboard: normalizeFingerboardConfig(partial?.fingerboard),
    timer: normalizeTimerConfig(partial?.timer),
  }
}

function mergeSnapshot(
  snapshot: GymSnapshot,
  parsed: Partial<GymSnapshot>,
  settingsExtra?: Partial<GymSettings>,
) {
  snapshot.settings = normalizeSettings({
    ...settingsExtra,
    ...parsed.settings,
  })
  snapshot.activityId =
    typeof parsed.activityId === 'string' || parsed.activityId === null
      ? parsed.activityId
      : snapshot.activityId
  snapshot.lastInteractionAt = asFiniteNumber(
    parsed.lastInteractionAt,
    snapshot.lastInteractionAt,
  )
  if (parsed.catchHoldSession) {
    snapshot.catchHoldSession = {
      ...idleCatchHoldSession,
      ...parsed.catchHoldSession,
    }
  }
  if (parsed.densityCircuitSession) {
    snapshot.densityCircuitSession = {
      ...idleDensityCircuitSession,
      ...parsed.densityCircuitSession,
    }
  }
  if (parsed.stationTrainingSession) {
    snapshot.stationTrainingSession = {
      ...idleStationTrainingSession,
      ...parsed.stationTrainingSession,
    }
  }
  if (parsed.techniqueFocusSession) {
    snapshot.techniqueFocusSession = {
      ...idleTechniqueFocusSession,
      ...parsed.techniqueFocusSession,
    }
  }
  if (parsed.emomSession) {
    snapshot.emomSession = {
      ...idleEmomSession,
      ...parsed.emomSession,
    }
  }
  if (parsed.choosePathSession) {
    snapshot.choosePathSession = normalizeChoosePathSession(parsed.choosePathSession)
  }
  if (parsed.fingerboardSession) {
    snapshot.fingerboardSession = {
      ...idleFingerboardSession,
      ...parsed.fingerboardSession,
    }
  }
  if (parsed.timerSession) {
    snapshot.timerSession = {
      ...idleTimerSession,
      ...parsed.timerSession,
    }
  }
}

export function parseRemoteSnapshot(raw: string): GymSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as Partial<GymSnapshot>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.lastInteractionAt !== 'number') return null
    const snapshot = defaultSnapshot()
    mergeSnapshot(snapshot, parsed)
    return snapshot
  } catch {
    return null
  }
}

export function loadLocalSnapshot(): GymSnapshot {
  const snapshot = defaultSnapshot()
  try {
    const settingsRaw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    const snapshotRaw = localStorage.getItem(SNAPSHOT_STORAGE_KEY)
    const fromSettings = settingsRaw
      ? (JSON.parse(settingsRaw) as Partial<GymSettings>)
      : undefined
    const parsedSnapshot = snapshotRaw
      ? (JSON.parse(snapshotRaw) as Partial<GymSnapshot>)
      : undefined

    if (parsedSnapshot) {
      mergeSnapshot(snapshot, parsedSnapshot, fromSettings)
    } else if (fromSettings) {
      snapshot.settings = normalizeSettings(fromSettings)
    }
  } catch {
    return snapshot
  }
  return snapshot
}

export function saveLocalSnapshot(snapshot: GymSnapshot) {
  localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot))
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(snapshot.settings))
}
