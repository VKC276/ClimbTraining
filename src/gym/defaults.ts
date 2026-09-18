import { defaultCatchHoldConfig, idleCatchHoldSession } from '../activities/catchHold/model'
import {
  defaultDensityCircuitConfig,
  idleDensityCircuitSession,
} from '../activities/densityCircuit/model'
import {
  defaultStationTrainingConfig,
  idleStationTrainingSession,
} from '../activities/stationTraining/model'
import {
  defaultTechniqueFocusConfig,
  idleTechniqueFocusSession,
} from '../activities/techniqueFocus/model'
import { defaultEmomConfig, idleEmomSession } from '../activities/emom/model'
import {
  defaultChoosePathConfig,
  idleChoosePathSession,
} from '../activities/choosePath/model'
import {
  defaultFingerboardConfig,
  idleFingerboardSession,
} from '../activities/fingerboard/model'
import { defaultTimerConfig, idleTimerSession } from '../activities/timer/model'
import {
  defaultDoubleRuleConfig,
  idleDoubleRuleSession,
} from '../activities/doubleRule/model'
import type { GymSettings, GymSnapshot } from '../types'
import { defaultFontId } from '../fonts'
import { defaultDisplayHardware } from './displayHardware'

export const SETTINGS_STORAGE_KEY = 'vvk-gym-settings-v1'
export const SNAPSHOT_STORAGE_KEY = 'vvk-gym-snapshot-v1'
export const DEFAULT_SYNC_ROOM = 'vastervikclimbing-gym'

export const defaultSettings: GymSettings = {
  clockStyle: 'analog',
  idleTimeoutMinutes: 5,
  idleLogoSize: 100,
  idleClockSize: 100,
  idleScreenIdSize: 100,
  syncRoom: DEFAULT_SYNC_ROOM,
  fontId: defaultFontId,
  displayHardware: { ...defaultDisplayHardware },
  catchHold: defaultCatchHoldConfig,
  densityCircuit: defaultDensityCircuitConfig,
  stationTraining: defaultStationTrainingConfig,
  techniqueFocus: defaultTechniqueFocusConfig,
  emom: defaultEmomConfig,
  choosePath: defaultChoosePathConfig,
  fingerboard: defaultFingerboardConfig,
  timer: defaultTimerConfig,
  doubleRule: defaultDoubleRuleConfig,
}

export function defaultSnapshot(now = Date.now()): GymSnapshot {
  return {
    activityId: null,
    lastInteractionAt: now,
    settings: {
      ...defaultSettings,
      displayHardware: { ...defaultDisplayHardware },
      catchHold: { ...defaultCatchHoldConfig },
      densityCircuit: { ...defaultDensityCircuitConfig },
      stationTraining: { ...defaultStationTrainingConfig },
      techniqueFocus: {
        ...defaultTechniqueFocusConfig,
        focuses: [...defaultTechniqueFocusConfig.focuses],
      },
      emom: {
        ...defaultEmomConfig,
        exercises: [...defaultEmomConfig.exercises],
      },
      choosePath: { ...defaultChoosePathConfig },
      fingerboard: { ...defaultFingerboardConfig },
      timer: { ...defaultTimerConfig },
      doubleRule: {
        ...defaultDoubleRuleConfig,
        category1: defaultDoubleRuleConfig.category1.map((card) => ({ ...card })),
        category2: defaultDoubleRuleConfig.category2.map((card) => ({ ...card })),
      },
    },
    catchHoldSession: { ...idleCatchHoldSession },
    densityCircuitSession: { ...idleDensityCircuitSession },
    stationTrainingSession: { ...idleStationTrainingSession },
    techniqueFocusSession: { ...idleTechniqueFocusSession },
    emomSession: { ...idleEmomSession },
    choosePathSession: { ...idleChoosePathSession },
    fingerboardSession: { ...idleFingerboardSession },
    timerSession: { ...idleTimerSession },
    doubleRuleSession: { ...idleDoubleRuleSession },
  }
}

export const idleTimeoutOptions = [1, 2, 5, 10, 15, 30, 60]
export const idleSizeMin = 50
export const idleSizeMax = 400

export function clampIdleSize(value: number) {
  const rounded = Math.round(value / 5) * 5
  return Math.min(idleSizeMax, Math.max(idleSizeMin, rounded))
}
