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
import { normalizeChoosePathConfig } from '../activities/choosePath/model'
import { idleChoosePathSession } from '../activities/choosePath/model'
import { normalizeFingerboardConfig } from '../activities/fingerboard/model'
import { idleFingerboardSession } from '../activities/fingerboard/model'
import { normalizeTimerConfig } from '../activities/timer/model'
import { idleTimerSession } from '../activities/timer/model'
import type { GymSettings, GymSnapshot } from '../types'
import { isFontId } from '../fonts'
import {
  SNAPSHOT_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  defaultSettings,
  defaultSnapshot,
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
    syncRoom:
      typeof partial?.syncRoom === 'string' && partial.syncRoom.trim()
        ? partial.syncRoom.trim()
        : defaultSettings.syncRoom,
    fontId: isFontId(partial?.fontId) ? partial.fontId : defaultSettings.fontId,
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

    snapshot.settings = normalizeSettings({
      ...fromSettings,
      ...parsedSnapshot?.settings,
    })
    if (parsedSnapshot) {
      snapshot.activityId =
        typeof parsedSnapshot.activityId === 'string' ||
        parsedSnapshot.activityId === null
          ? parsedSnapshot.activityId
          : null
      snapshot.lastInteractionAt = asFiniteNumber(
        parsedSnapshot.lastInteractionAt,
        snapshot.lastInteractionAt,
      )
      if (parsedSnapshot.catchHoldSession) {
        snapshot.catchHoldSession = {
          ...idleCatchHoldSession,
          ...parsedSnapshot.catchHoldSession,
        }
      }
      if (parsedSnapshot.densityCircuitSession) {
        snapshot.densityCircuitSession = {
          ...idleDensityCircuitSession,
          ...parsedSnapshot.densityCircuitSession,
        }
      }
      if (parsedSnapshot.stationTrainingSession) {
        snapshot.stationTrainingSession = {
          ...idleStationTrainingSession,
          ...parsedSnapshot.stationTrainingSession,
        }
      }
      if (parsedSnapshot.techniqueFocusSession) {
        snapshot.techniqueFocusSession = {
          ...idleTechniqueFocusSession,
          ...parsedSnapshot.techniqueFocusSession,
        }
      }
      if (parsedSnapshot.emomSession) {
        snapshot.emomSession = {
          ...idleEmomSession,
          ...parsedSnapshot.emomSession,
        }
      }
      if (parsedSnapshot.choosePathSession) {
        snapshot.choosePathSession = {
          ...idleChoosePathSession,
          ...parsedSnapshot.choosePathSession,
        }
      }
      if (parsedSnapshot.fingerboardSession) {
        snapshot.fingerboardSession = {
          ...idleFingerboardSession,
          ...parsedSnapshot.fingerboardSession,
        }
      }
      if (parsedSnapshot.timerSession) {
        snapshot.timerSession = {
          ...idleTimerSession,
          ...parsedSnapshot.timerSession,
        }
      }
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
