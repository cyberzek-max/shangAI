import type { JointAngles, PoseLandmarks } from '../types'
import type { GhostCombo, GhostFrame } from './types'

const GHOST_KEY = 'athletemind.ghosts.v1'
const RECORD_FPS = 15
const MAX_FRAMES = 300 // ~20s cap keeps localStorage small

export interface StoredGhost {
  id: string
  name: string
  createdAt: number
  /** Flat [x,y,z,v]*33 per frame, rounded to 3 decimals. */
  frames: number[][]
}

function flat(lms: PoseLandmarks): number[] {
  const out: number[] = []
  for (let i = 0; i < 33; i++) {
    const p = lms[i]
    if (!p) out.push(0, 0, 0, 0)
    else out.push(+p.x.toFixed(3), +p.y.toFixed(3), +(p.z ?? 0).toFixed(3), +(p.visibility ?? 0).toFixed(2))
  }
  return out
}

function unflat(f: number[]): PoseLandmarks {
  const out: PoseLandmarks = []
  for (let i = 0; i < 33; i++) {
    out.push({ x: f[i * 4] ?? 0, y: f[i * 4 + 1] ?? 0, z: f[i * 4 + 2] ?? 0, visibility: f[i * 4 + 3] ?? 0 })
  }
  return out
}

export function loadGhosts(): StoredGhost[] {
  try {
    const raw = localStorage.getItem(GHOST_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as StoredGhost[]
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveGhosts(g: StoredGhost[]): void {
  try {
    localStorage.setItem(GHOST_KEY, JSON.stringify(g))
  } catch {
    // Quota: drop oldest and retry once.
    try {
      localStorage.setItem(GHOST_KEY, JSON.stringify(g.slice(-3)))
    } catch {
      /* give up */
    }
  }
}

export function deleteGhost(id: string): StoredGhost[] {
  const next = loadGhosts().filter((g) => g.id !== id)
  saveGhosts(next)
  return next
}

/** Records the user's own movement as a reusable ghost rival. */
export class GhostRecorder {
  private frames: number[][] = []
  private lastAt = 0
  recording = false

  start(): void {
    this.frames = []
    this.lastAt = 0
    this.recording = true
  }

  push(lms: PoseLandmarks | null, nowMs: number): void {
    if (!this.recording || !lms) return
    if (nowMs - this.lastAt < 1000 / RECORD_FPS) return
    if (this.frames.length >= MAX_FRAMES) {
      this.stop()
      return
    }
    this.lastAt = nowMs
    this.frames.push(flat(lms))
  }

  get count(): number {
    return this.frames.length
  }

  stop(name = 'My ghost'): StoredGhost | null {
    this.recording = false
    if (this.frames.length < RECORD_FPS * 2) return null // need ≥2s
    const ghost: StoredGhost = {
      id: `ghost-${Date.now()}`,
      name,
      createdAt: Date.now(),
      frames: this.frames,
    }
    const all = [...loadGhosts(), ghost].slice(-8)
    saveGhosts(all)
    return ghost
  }
}

/** Loops a recorded ghost with linear interpolation between frames. */
export class GhostPlayer {
  private ghost: StoredGhost | null = null
  private startAt = 0

  load(g: StoredGhost | null, nowMs: number): void {
    this.ghost = g
    this.startAt = nowMs
  }

  get loaded(): boolean {
    return !!this.ghost && this.ghost.frames.length > 1
  }

  get durationMs(): number {
    if (!this.ghost) return 0
    return (this.ghost.frames.length / RECORD_FPS) * 1000
  }

  frame(nowMs: number): GhostFrame | null {
    const g = this.ghost
    if (!g || g.frames.length < 2) return null
    const dur = this.durationMs
    // Positive modulo: session clocks may run behind wall time (pause shifts).
    const t = ((((nowMs - this.startAt) % dur) + dur) % dur) / dur
    const pos = t * (g.frames.length - 1)
    const i0 = Math.floor(pos)
    const i1 = Math.min(g.frames.length - 1, i0 + 1)
    const f = pos - i0
    const a = unflat(g.frames[i0])
    const b = unflat(g.frames[i1])
    const out: PoseLandmarks = a.map((p, i) => ({
      x: p.x + (b[i].x - p.x) * f,
      y: p.y + (b[i].y - p.y) * f,
      z: p.z + (b[i].z - p.z) * f,
      visibility: p.visibility,
    }))
    return { at: nowMs, landmarks: out }
  }
}

/**
 * Samples a GhostCombo timeline at time t (loops). Numeric targets present in
 * both surrounding keyframes are interpolated; others are held.
 */
export function sampleCombo(
  combo: GhostCombo,
  nowMs: number,
  startAt: number,
): { targets: Partial<Record<keyof JointAngles, number>>; label: string; phase: number } {
  const t = ((nowMs - startAt) % combo.durationMs + combo.durationMs) % combo.durationMs
  const kfs = [...combo.keyframes].sort((a, b) => a.at - b.at)
  let i0 = kfs.length - 1
  for (let i = 0; i < kfs.length; i++) {
    if (kfs[i].at <= t) i0 = i
  }
  const k0 = kfs[i0]
  const k1 = kfs[(i0 + 1) % kfs.length]
  const end = (i0 + 1) % kfs.length === 0 ? combo.durationMs : k1.at
  const span = Math.max(1, end - k0.at)
  const f = Math.max(0, Math.min(1, (t - k0.at) / span))

  // Forward-fill: effective targets accumulate through the timeline.
  const eff0: Partial<Record<keyof JointAngles, number>> = {}
  for (let i = 0; i <= i0; i++) Object.assign(eff0, kfs[i].targets)
  const targets: Partial<Record<keyof JointAngles, number>> = { ...eff0 }
  for (const key of Object.keys(k1.targets) as (keyof JointAngles)[]) {
    const v0 = eff0[key]
    const v1 = k1.targets[key] as number
    targets[key] = v0 === undefined ? v1 : v0 + (v1 - v0) * f
  }
  const label = f < 0.5 ? k0.label : k1.label
  return { targets, label, phase: t / combo.durationMs }
}
