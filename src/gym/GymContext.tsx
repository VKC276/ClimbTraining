import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import {
  idleCatchHoldSession,
  normalizeCatchHoldConfig,
  type CatchHoldConfig,
  type CatchHoldSession,
} from '../activities/catchHold/model'
import {
  idleDensityCircuitSession,
  normalizeDensityCircuitConfig,
  type DensityCircuitConfig,
  type DensityCircuitSession,
} from '../activities/densityCircuit/model'
import {
  idleStationTrainingSession,
  normalizeStationTrainingConfig,
  type StationTrainingConfig,
  type StationTrainingSession,
} from '../activities/stationTraining/model'
import {
  idleTechniqueFocusSession,
  normalizeTechniqueFocusConfig,
  type TechniqueFocusConfig,
  type TechniqueFocusSession,
} from '../activities/techniqueFocus/model'
import {
  idleEmomSession,
  normalizeEmomConfig,
  type EmomConfig,
  type EmomSession,
} from '../activities/emom/model'
import {
  idleChoosePathSession,
  normalizeChoosePathConfig,
  type ChoosePathConfig,
  type ChoosePathSession,
} from '../activities/choosePath/model'
import {
  idleFingerboardSession,
  normalizeFingerboardConfig,
  type FingerboardConfig,
  type FingerboardSession,
} from '../activities/fingerboard/model'
import {
  idleTimerSession,
  normalizeTimerConfig,
  type TimerConfig,
  type TimerSession,
} from '../activities/timer/model'
import type { GymSettings, GymSnapshot } from '../types'
import { defaultSnapshot } from './defaults'
import { loadLocalSnapshot, normalizeSettings, saveLocalSnapshot } from './storage'

type GymContextValue = {
  snapshot: GymSnapshot
  startActivity: (activityId: string) => void
  endActivity: () => void
  bumpInteraction: () => void
  updateSettings: (patch: Partial<GymSettings>) => void
  updateCatchHold: (patch: Partial<CatchHoldConfig>) => void
  setCatchHoldSession: (session: CatchHoldSession) => void
  updateDensityCircuit: (patch: Partial<DensityCircuitConfig>) => void
  setDensityCircuitSession: (session: DensityCircuitSession) => void
  updateStationTraining: (patch: Partial<StationTrainingConfig>) => void
  setStationTrainingSession: (session: StationTrainingSession) => void
  updateTechniqueFocus: (patch: Partial<TechniqueFocusConfig>) => void
  setTechniqueFocusSession: (session: TechniqueFocusSession) => void
  updateEmom: (patch: Partial<EmomConfig>) => void
  setEmomSession: (session: EmomSession) => void
  updateChoosePath: (patch: Partial<ChoosePathConfig>) => void
  setChoosePathSession: (session: ChoosePathSession) => void
  updateFingerboard: (patch: Partial<FingerboardConfig>) => void
  setFingerboardSession: (session: FingerboardSession) => void
  updateTimer: (patch: Partial<TimerConfig>) => void
  setTimerSession: (session: TimerSession) => void
}

const GymContext = createContext<GymContextValue | null>(null)

function readSnapshot(map: Y.Map<unknown>): GymSnapshot {
  const fallback = defaultSnapshot()
  const activityId = map.get('activityId')
  const lastInteractionAt = map.get('lastInteractionAt')
  const settings = map.get('settings') as Partial<GymSettings> | undefined
  const catchHoldSession = map.get('catchHoldSession') as
    | Partial<CatchHoldSession>
    | undefined
  const densityCircuitSession = map.get('densityCircuitSession') as
    | Partial<DensityCircuitSession>
    | undefined
  const stationTrainingSession = map.get('stationTrainingSession') as
    | Partial<StationTrainingSession>
    | undefined
  const techniqueFocusSession = map.get('techniqueFocusSession') as
    | Partial<TechniqueFocusSession>
    | undefined
  const emomSession = map.get('emomSession') as Partial<EmomSession> | undefined
  const choosePathSession = map.get('choosePathSession') as
    | Partial<ChoosePathSession>
    | undefined
  const fingerboardSession = map.get('fingerboardSession') as
    | Partial<FingerboardSession>
    | undefined
  const timerSession = map.get('timerSession') as Partial<TimerSession> | undefined
  return {
    activityId: typeof activityId === 'string' ? activityId : null,
    lastInteractionAt:
      typeof lastInteractionAt === 'number' && Number.isFinite(lastInteractionAt)
        ? lastInteractionAt
        : fallback.lastInteractionAt,
    settings: normalizeSettings(settings),
    catchHoldSession: {
      ...idleCatchHoldSession,
      ...(catchHoldSession ?? {}),
    },
    densityCircuitSession: {
      ...idleDensityCircuitSession,
      ...(densityCircuitSession ?? {}),
    },
    stationTrainingSession: {
      ...idleStationTrainingSession,
      ...(stationTrainingSession ?? {}),
    },
    techniqueFocusSession: {
      ...idleTechniqueFocusSession,
      ...(techniqueFocusSession ?? {}),
    },
    emomSession: {
      ...idleEmomSession,
      ...(emomSession ?? {}),
    },
    choosePathSession: {
      ...idleChoosePathSession,
      ...(choosePathSession ?? {}),
    },
    fingerboardSession: {
      ...idleFingerboardSession,
      ...(fingerboardSession ?? {}),
    },
    timerSession: {
      ...idleTimerSession,
      ...(timerSession ?? {}),
    },
  }
}

function writeSnapshot(map: Y.Map<unknown>, snapshot: GymSnapshot) {
  map.set('activityId', snapshot.activityId)
  map.set('lastInteractionAt', snapshot.lastInteractionAt)
  map.set('settings', snapshot.settings)
  map.set('catchHoldSession', snapshot.catchHoldSession)
  map.set('densityCircuitSession', snapshot.densityCircuitSession)
  map.set('stationTrainingSession', snapshot.stationTrainingSession)
  map.set('techniqueFocusSession', snapshot.techniqueFocusSession)
  map.set('emomSession', snapshot.emomSession)
  map.set('choosePathSession', snapshot.choosePathSession)
  map.set('fingerboardSession', snapshot.fingerboardSession)
  map.set('timerSession', snapshot.timerSession)
}

export function GymProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadLocalSnapshot(), [])
  const [snapshot, setSnapshot] = useState<GymSnapshot>(initial)
  const snapshotRef = useRef(snapshot)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const docRef = useRef<Y.Doc | null>(null)
  const mapRef = useRef<Y.Map<unknown> | null>(null)
  const syncRoom = snapshot.settings.syncRoom

  useEffect(() => {
    const doc = new Y.Doc()
    const map = doc.getMap('gym')
    docRef.current = doc
    mapRef.current = map

    const applyFromMap = () => {
      if (map.get('lastInteractionAt') == null) return
      const next = readSnapshot(map)
      snapshotRef.current = next
      setSnapshot(next)
      saveLocalSnapshot(next)
    }

    map.observeDeep(applyFromMap)

    const room = syncRoom.trim() || 'vastervikclimbing-gym'
    const provider = new WebrtcProvider(room, doc, { password: room })

    const seedIfAlone = () => {
      if (map.get('lastInteractionAt') == null) {
        writeSnapshot(map, snapshotRef.current)
      }
    }

    provider.on('synced', seedIfAlone)
    const seedTimer = window.setTimeout(seedIfAlone, 1200)

    return () => {
      window.clearTimeout(seedTimer)
      map.unobserveDeep(applyFromMap)
      provider.off('synced', seedIfAlone)
      provider.destroy()
      doc.destroy()
      docRef.current = null
      mapRef.current = null
    }
  }, [syncRoom])

  const commit = useCallback((next: GymSnapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
    saveLocalSnapshot(next)
    if (mapRef.current) writeSnapshot(mapRef.current, next)
  }, [])

  const bumpInteraction = useCallback(() => {
    commit({ ...snapshotRef.current, lastInteractionAt: Date.now() })
  }, [commit])

  const startActivity = useCallback(
    (activityId: string) => {
      commit({
        ...snapshotRef.current,
        activityId,
        lastInteractionAt: Date.now(),
        catchHoldSession: { ...idleCatchHoldSession },
        densityCircuitSession: { ...idleDensityCircuitSession },
        stationTrainingSession: { ...idleStationTrainingSession },
        techniqueFocusSession: { ...idleTechniqueFocusSession },
        emomSession: { ...idleEmomSession },
        choosePathSession: { ...idleChoosePathSession },
        fingerboardSession: { ...idleFingerboardSession },
        timerSession: { ...idleTimerSession },
      })
    },
    [commit],
  )

  const endActivity = useCallback(() => {
    commit({
      ...snapshotRef.current,
      activityId: null,
      lastInteractionAt: Date.now(),
      catchHoldSession: { ...idleCatchHoldSession },
      densityCircuitSession: { ...idleDensityCircuitSession },
      stationTrainingSession: { ...idleStationTrainingSession },
      techniqueFocusSession: { ...idleTechniqueFocusSession },
      emomSession: { ...idleEmomSession },
      choosePathSession: { ...idleChoosePathSession },
      fingerboardSession: { ...idleFingerboardSession },
      timerSession: { ...idleTimerSession },
    })
  }, [commit])

  const updateCatchHold = useCallback(
    (patch: Partial<CatchHoldConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          catchHold: normalizeCatchHoldConfig({
            ...current.settings.catchHold,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setCatchHoldSession = useCallback(
    (session: CatchHoldSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        catchHoldSession: session,
      })
    },
    [commit],
  )

  const setDensityCircuitSession = useCallback(
    (session: DensityCircuitSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        densityCircuitSession: session,
      })
    },
    [commit],
  )

  const updateDensityCircuit = useCallback(
    (patch: Partial<DensityCircuitConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          densityCircuit: normalizeDensityCircuitConfig({
            ...current.settings.densityCircuit,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setStationTrainingSession = useCallback(
    (session: StationTrainingSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        stationTrainingSession: session,
      })
    },
    [commit],
  )

  const updateStationTraining = useCallback(
    (patch: Partial<StationTrainingConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          stationTraining: normalizeStationTrainingConfig({
            ...current.settings.stationTraining,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setTechniqueFocusSession = useCallback(
    (session: TechniqueFocusSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        techniqueFocusSession: session,
      })
    },
    [commit],
  )

  const updateTechniqueFocus = useCallback(
    (patch: Partial<TechniqueFocusConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          techniqueFocus: normalizeTechniqueFocusConfig({
            ...current.settings.techniqueFocus,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setEmomSession = useCallback(
    (session: EmomSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        emomSession: session,
      })
    },
    [commit],
  )

  const updateEmom = useCallback(
    (patch: Partial<EmomConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          emom: normalizeEmomConfig({
            ...current.settings.emom,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setChoosePathSession = useCallback(
    (session: ChoosePathSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        choosePathSession: session,
      })
    },
    [commit],
  )

  const updateChoosePath = useCallback(
    (patch: Partial<ChoosePathConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          choosePath: normalizeChoosePathConfig({
            ...current.settings.choosePath,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setFingerboardSession = useCallback(
    (session: FingerboardSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        fingerboardSession: session,
      })
    },
    [commit],
  )

  const updateFingerboard = useCallback(
    (patch: Partial<FingerboardConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          fingerboard: normalizeFingerboardConfig({
            ...current.settings.fingerboard,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const setTimerSession = useCallback(
    (session: TimerSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        timerSession: session,
      })
    },
    [commit],
  )

  const updateTimer = useCallback(
    (patch: Partial<TimerConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          timer: normalizeTimerConfig({
            ...current.settings.timer,
            ...patch,
          }),
        },
      })
    },
    [commit],
  )

  const updateSettings = useCallback(
    (patch: Partial<GymSettings>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: normalizeSettings({ ...current.settings, ...patch }),
      })
    },
    [commit],
  )

  const value = useMemo(
    () => ({
      snapshot,
      startActivity,
      endActivity,
      bumpInteraction,
      updateSettings,
      updateCatchHold,
      setCatchHoldSession,
      updateDensityCircuit,
      setDensityCircuitSession,
      updateStationTraining,
      setStationTrainingSession,
      updateTechniqueFocus,
      setTechniqueFocusSession,
      updateEmom,
      setEmomSession,
      updateChoosePath,
      setChoosePathSession,
      updateFingerboard,
      setFingerboardSession,
      updateTimer,
      setTimerSession,
    }),
    [
      snapshot,
      startActivity,
      endActivity,
      bumpInteraction,
      updateSettings,
      updateCatchHold,
      setCatchHoldSession,
      updateDensityCircuit,
      setDensityCircuitSession,
      updateStationTraining,
      setStationTrainingSession,
      updateTechniqueFocus,
      setTechniqueFocusSession,
      updateEmom,
      setEmomSession,
      updateChoosePath,
      setChoosePathSession,
      updateFingerboard,
      setFingerboardSession,
      updateTimer,
      setTimerSession,
    ],
  )

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>
}

export function useGym() {
  const context = useContext(GymContext)
  if (!context) throw new Error('useGym måste användas inuti GymProvider')
  return context
}
