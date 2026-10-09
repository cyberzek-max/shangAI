import { create } from 'zustand'
import type { ProgressState, SessionStats, Settings } from '../types'
import type { ClashMode, ClashReport } from '../clash/types'
import { loadProgress, loadSettings, saveProgress, saveSettings } from './storage'

export type Screen =
  | 'home'
  | 'setup'
  | 'select'
  | 'game'
  | 'results'
  | 'rival'
  | 'clash'
  | 'clash-report'

export type ClashRival = 'reference' | 'recorded' | 'live' | 'none'

export interface ClashConfig {
  mode: ClashMode
  poseId: string
  comboId: string
  rival: ClashRival
  ghostId?: string
  durationSec: number
  voice: boolean
  relayUrl: string
  room: string
}

export const DEFAULT_CLASH: ClashConfig = {
  mode: 'flow',
  poseId: 'warrior2',
  comboId: 'jab-cross-hook',
  rival: 'reference',
  durationSec: 60,
  voice: true,
  relayUrl: '',
  room: 'dojo-1',
}

export interface HudSnapshot {
  status: string
  playerHp: number
  playerMaxHp: number
  energy: number
  maxEnergy: number
  shieldMs: number
  invulnMs: number
  enemyHp: number
  enemyMaxHp: number
  enemyName: string
  enemyWindup: number
  enemyTimerRatio: number
  score: number
  combo: number
  xp: number
  level: number
  timeMs: number
  reps: number
  feedback: string
  depth: number
  detected: boolean
  confidence: number
  adaptiveLevel: number
  lastAction: string | null
  events: { id: number; text: string; tone: string }[]
}

const EMPTY_HUD: HudSnapshot = {
  status: 'idle',
  playerHp: 100,
  playerMaxHp: 100,
  energy: 0,
  maxEnergy: 100,
  shieldMs: 0,
  invulnMs: 0,
  enemyHp: 100,
  enemyMaxHp: 100,
  enemyName: '',
  enemyWindup: 0,
  enemyTimerRatio: 0,
  score: 0,
  combo: 0,
  xp: 0,
  level: 1,
  timeMs: 0,
  reps: 0,
  feedback: '',
  depth: 0,
  detected: false,
  confidence: 0,
  adaptiveLevel: 0,
  lastAction: null,
  events: [],
}

interface AppStore {
  screen: Screen
  settings: Settings
  progress: ProgressState
  hud: HudSnapshot
  practice: boolean
  lastStats: SessionStats | null
  go: (screen: Screen) => void
  updateSettings: (patch: Partial<Settings>) => void
  setProgress: (p: ProgressState) => void
  setHud: (hud: HudSnapshot) => void
  setPractice: (v: boolean) => void
  setLastStats: (s: SessionStats | null) => void
  clash: ClashConfig
  setClash: (patch: Partial<ClashConfig>) => void
  clashReport: ClashReport | null
  setClashReport: (r: ClashReport | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  screen: 'home',
  settings: loadSettings(),
  progress: loadProgress(),
  hud: EMPTY_HUD,
  practice: false,
  lastStats: null,
  go: (screen) => set({ screen }),
  updateSettings: (patch) =>
    set((s) => {
      const settings = { ...s.settings, ...patch }
      saveSettings(settings)
      return { settings }
    }),
  setProgress: (progress) => {
    saveProgress(progress)
    set({ progress })
  },
  setHud: (hud) => set({ hud }),
  setPractice: (practice) => set({ practice }),
  setLastStats: (lastStats) => set({ lastStats }),
  clash: { ...DEFAULT_CLASH },
  setClash: (patch) => set((s) => ({ clash: { ...s.clash, ...patch } })),
  clashReport: null,
  setClashReport: (clashReport) => set({ clashReport }),
}))

export function resetHud(): HudSnapshot {
  return { ...EMPTY_HUD, events: [] }
}
