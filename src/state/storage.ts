import type { ProgressState, SessionStats, Settings } from '../types'

const SETTINGS_KEY = 'athletemind.settings.v1'
const PROGRESS_KEY = 'athletemind.progress.v1'

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'adaptive',
  sound: true,
  selectedExercise: 'squat',
  gameMode: 'bounty',
  maxIntensity: 'medium',
}

export const DEFAULT_PROGRESS: ProgressState = {
  xp: 0,
  level: 1,
  totalSessions: 0,
  totalReps: 0,
  achievements: [],
  history: [],
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return { ...fallback, ...(JSON.parse(raw) as T) }
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage may be unavailable (private mode); degrade gracefully.
  }
}

export function loadSettings(): Settings {
  return read(SETTINGS_KEY, DEFAULT_SETTINGS)
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s)
}

export function loadProgress(): ProgressState {
  const p = read(PROGRESS_KEY, DEFAULT_PROGRESS)
  p.achievements = Array.isArray(p.achievements) ? p.achievements : []
  p.history = Array.isArray(p.history) ? p.history : []
  p.level = typeof p.level === 'number' && p.level >= 1 ? Math.floor(p.level) : 1
  p.xp = typeof p.xp === 'number' && p.xp >= 0 ? p.xp : 0
  p.totalSessions = typeof p.totalSessions === 'number' && p.totalSessions >= 0 ? p.totalSessions : 0
  p.totalReps = typeof p.totalReps === 'number' && p.totalReps >= 0 ? p.totalReps : 0
  return p
}

export function saveProgress(p: ProgressState): void {
  write(PROGRESS_KEY, p)
}

/** XP required to reach the next level from the current level. */
export function xpToNext(level: number): number {
  return 100 * level
}

function levelFromXp(xp: number): number {
  let level = 1
  let remaining = xp
  while (remaining >= xpToNext(level)) {
    remaining -= xpToNext(level)
    level += 1
  }
  return level
}

export const ACHIEVEMENT_DEFS: { id: string; name: string; check: (p: ProgressState, s: SessionStats) => boolean }[] =
  [
    { id: 'first-session', name: 'First Steps', check: (p) => p.totalSessions >= 1 },
    { id: 'ten-reps', name: 'Warmed Up', check: (p) => p.totalReps >= 10 },
    { id: 'century', name: 'Century Club', check: (p) => p.totalReps >= 100 },
    { id: 'combo-10', name: 'Combo Master', check: (_p, s) => s.peakCombo >= 10 },
    { id: 'victor', name: 'Wraith Slayer', check: (_p, s) => s.outcome === 'victory' },
    { id: 'consistent', name: 'Steady Form', check: (_p, s) => s.avgConsistency >= 80 && s.reps >= 5 },
  ]

/** Fold a finished session into persistent progress and unlock achievements. */
export function applySession(progress: ProgressState, stats: SessionStats): ProgressState {
  const next: ProgressState = {
    ...progress,
    xp: progress.xp + stats.xpEarned,
    totalSessions: progress.totalSessions + 1,
    totalReps: progress.totalReps + stats.validReps,
    history: [...progress.history, stats].slice(-30),
    achievements: [...progress.achievements],
  }
  next.level = levelFromXp(next.xp)
  for (const def of ACHIEVEMENT_DEFS) {
    if (!next.achievements.includes(def.id) && def.check(next, stats)) {
      next.achievements.push(def.id)
    }
  }
  return next
}
