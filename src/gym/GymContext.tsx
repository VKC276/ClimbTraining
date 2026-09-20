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
import {
  idleDoubleRuleSession,
  normalizeDoubleRuleConfig,
  type DoubleRuleConfig,
  type DoubleRuleSession,
} from '../activities/doubleRule/model'
import type { GymSettings, GymSnapshot } from '../types'
import {
  clearTrainerScreenId,
  ensureDeviceId,
  isDisplayPath,
  isScreenId,
  normalizeScreenId,
  readTrainerScreenId,
  saveTrainerScreenId,
} from './screenId'
import {
  loadLocalSnapshot,
  normalizeSettings,
  parseRemoteSnapshot,
  saveLocalSnapshot,
} from './storage'
import { syncSocketUrl, type SyncStatus } from './sync'

type GymContextValue = {
  snapshot: GymSnapshot
  syncStatus: SyncStatus
  hasScreenAccess: boolean
  displayOnline: boolean
  screenId: string | null
  pairScreen: (id: string) => void
  unpairScreen: () => void
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
  updateDoubleRule: (patch: Partial<DoubleRuleConfig>) => void
  setDoubleRuleSession: (session: DoubleRuleSession) => void
}

const GymContext = createContext<GymContextValue | null>(null)

export function GymProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadLocalSnapshot(), [])
  const isDisplay = useMemo(() => isDisplayPath(), [])
  const deviceId = useMemo(() => (isDisplay ? ensureDeviceId() : null), [isDisplay])
  const [snapshot, setSnapshot] = useState<GymSnapshot>(initial)
  const [screenId, setScreenId] = useState<string | null>(() =>
    isDisplay ? null : readTrainerScreenId(),
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting')
  const [displayOnline, setDisplayOnline] = useState(false)
  const snapshotRef = useRef(snapshot)
  const socketRef = useRef<WebSocket | null>(null)
  const applyingRemote = useRef(false)

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const pairScreen = useCallback((id: string) => {
    const next = normalizeScreenId(id)
    if (!isScreenId(next)) return
    saveTrainerScreenId(next)
    setScreenId(next)
  }, [])

  const unpairScreen = useCallback(() => {
    clearTrainerScreenId()
    setScreenId(null)
    setDisplayOnline(false)
  }, [])

  useEffect(() => {
    if (!isDisplay && (!screenId || !isScreenId(screenId))) {
      setSyncStatus('offline')
      setDisplayOnline(false)
      return
    }
    if (isDisplay && !deviceId) {
      setSyncStatus('offline')
      setDisplayOnline(false)
      return
    }

    let stopped = false
    let retryTimer = 0
    let seedTimer = 0
    let delay = 600

    const connect = () => {
      if (stopped) return
      setDisplayOnline(false)
      setSyncStatus('connecting')
      const socket = new WebSocket(
        isDisplay && deviceId
          ? syncSocketUrl({ role: 'display', device: deviceId })
          : syncSocketUrl({ role: 'trainer', screen: screenId ?? '' }),
      )
      socketRef.current = socket
      let gotRemote = false
      let heartbeat = 0

      socket.onopen = () => {
        delay = 600
        setSyncStatus('connected')
        heartbeat = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping')
        }, 20000)
        seedTimer = window.setTimeout(() => {
          if (!gotRemote && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(snapshotRef.current))
          }
        }, 400)
      }

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string' || !event.data.startsWith('{')) return
        try {
          const payload = JSON.parse(event.data) as {
            type?: string
            id?: string
            displayOnline?: boolean
          }
          if (payload.type === 'screen' && typeof payload.id === 'string' && isScreenId(payload.id)) {
            setScreenId(payload.id)
            return
          }
          if (payload.type === 'presence') {
            setDisplayOnline(payload.displayOnline === true)
            return
          }
        } catch {
          return
        }
        const remote = parseRemoteSnapshot(event.data)
        if (!remote) return
        gotRemote = true
        if (remote.lastInteractionAt < snapshotRef.current.lastInteractionAt) return
        applyingRemote.current = true
        snapshotRef.current = remote
        setSnapshot(remote)
        saveLocalSnapshot(remote)
        applyingRemote.current = false
      }

      socket.onclose = () => {
        window.clearTimeout(seedTimer)
        window.clearInterval(heartbeat)
        setSyncStatus('offline')
        setDisplayOnline(false)
        socketRef.current = null
        if (stopped) return
        retryTimer = window.setTimeout(connect, delay)
        delay = Math.min(8000, delay * 2)
      }

      socket.onerror = () => {
        socket.close()
      }
    }

    connect()

    return () => {
      stopped = true
      window.clearTimeout(retryTimer)
      window.clearTimeout(seedTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [isDisplay, deviceId, isDisplay ? null : screenId])

  const commit = useCallback((next: GymSnapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
    saveLocalSnapshot(next)
    const socket = socketRef.current
    if (!applyingRemote.current && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(next))
    }
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
        doubleRuleSession: { ...idleDoubleRuleSession },
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
      doubleRuleSession: { ...idleDoubleRuleSession },
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

  const setDoubleRuleSession = useCallback(
    (session: DoubleRuleSession) => {
      commit({
        ...snapshotRef.current,
        lastInteractionAt: Date.now(),
        doubleRuleSession: session,
      })
    },
    [commit],
  )

  const updateDoubleRule = useCallback(
    (patch: Partial<DoubleRuleConfig>) => {
      const current = snapshotRef.current
      commit({
        ...current,
        lastInteractionAt: Date.now(),
        settings: {
          ...current.settings,
          doubleRule: normalizeDoubleRuleConfig({
            ...current.settings.doubleRule,
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
      syncStatus,
      displayOnline,
      hasScreenAccess: Boolean(
        screenId && isScreenId(screenId) && (isDisplay || displayOnline),
      ),
      screenId,
      pairScreen,
      unpairScreen,
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
      updateDoubleRule,
      setDoubleRuleSession,
    }),
    [
      snapshot,
      syncStatus,
      displayOnline,
      isDisplay,
      screenId,
      pairScreen,
      unpairScreen,
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
      updateDoubleRule,
      setDoubleRuleSession,
    ],
  )

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>
}

export function useGym() {
  const context = useContext(GymContext)
  if (!context) throw new Error('useGym måste användas inuti GymProvider')
  return context
}
