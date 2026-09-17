import type { FontId } from './fonts'
import type { DisplayHardware } from './gym/displayHardware'
import type { CatchHoldConfig, CatchHoldSession } from './activities/catchHold/model'
import type {
  DensityCircuitConfig,
  DensityCircuitSession,
} from './activities/densityCircuit/model'
import type {
  StationTrainingConfig,
  StationTrainingSession,
} from './activities/stationTraining/model'
import type {
  TechniqueFocusConfig,
  TechniqueFocusSession,
} from './activities/techniqueFocus/model'
import type { EmomConfig, EmomSession } from './activities/emom/model'
import type {
  ChoosePathConfig,
  ChoosePathSession,
} from './activities/choosePath/model'
import type {
  FingerboardConfig,
  FingerboardSession,
} from './activities/fingerboard/model'
import type { TimerConfig, TimerSession } from './activities/timer/model'

export type ClockStyle = 'analog' | 'digital'

export type GymSettings = {
  clockStyle: ClockStyle
  idleTimeoutMinutes: number
  idleLogoSize: number
  idleClockSize: number
  idleScreenIdSize: number
  syncRoom: string
  fontId: FontId
  displayHardware: DisplayHardware
  catchHold: CatchHoldConfig
  densityCircuit: DensityCircuitConfig
  stationTraining: StationTrainingConfig
  techniqueFocus: TechniqueFocusConfig
  emom: EmomConfig
  choosePath: ChoosePathConfig
  fingerboard: FingerboardConfig
  timer: TimerConfig
}

export type GymSnapshot = {
  activityId: string | null
  lastInteractionAt: number
  settings: GymSettings
  catchHoldSession: CatchHoldSession
  densityCircuitSession: DensityCircuitSession
  stationTrainingSession: StationTrainingSession
  techniqueFocusSession: TechniqueFocusSession
  emomSession: EmomSession
  choosePathSession: ChoosePathSession
  fingerboardSession: FingerboardSession
  timerSession: TimerSession
}

export type Activity = {
  id: string
  title: string
  description: string
}
