import type { JointAngles, PoseLandmarks } from '../types'

/** The two clash activity families. */
export type ClashMode = 'flow' | 'action'

/** Where the rival reference comes from. */
export type RivalSource =
  | { kind: 'ghost'; ghostId: string }
  | { kind: 'live' }
  | { kind: 'none' }

/** One scored joint target inside a static reference pose. */
export interface JointTarget {
  joint: keyof JointAngles
  /** Ideal angle in degrees. */
  target: number
  /** ±degrees counted as correct (green). Beyond 2×tol counts as wrong (red). */
  tol: number
  cue: string
}

/** Static/flow reference pose (Mode A). */
export interface ReferencePose {
  id: string
  name: string
  icon: string
  description: string
  holdMs: number
  joints: JointTarget[]
}

/** One keyframe inside a ghost combo timeline (Mode B). */
export interface ComboKeyframe {
  /** ms offset from combo start. */
  at: number
  label: string
  /** Sparse joint-angle targets; missing joints are not scored. */
  targets: Partial<Record<keyof JointAngles, number>>
}

/** Pre-recorded ideal sequence for action mode. */
export interface GhostCombo {
  id: string
  name: string
  icon: string
  description: string
  /** Total loop duration in ms. */
  durationMs: number
  keyframes: ComboKeyframe[]
}

export type StrikeKind = 'jab' | 'cross' | 'hook' | 'kick'

export interface StrikeEvent {
  kind: StrikeKind
  /** ms timestamp (performance.now basis). */
  at: number
  /** 0..1 execution quality. */
  quality: number
  /** Peak hand/foot speed in normalized-units/sec. */
  speed: number
}

export interface JointScore {
  joint: keyof JointAngles
  user: number
  target: number
  /** 0..1 per-joint score. */
  score: number
  ok: boolean
}

/** Frame-level match result against the current reference. */
export interface MatchResult {
  /** 0..100 overall accuracy. */
  accuracy: number
  joints: JointScore[]
  /** Worst offending joints (for arrows + cues), worst first. */
  defects: JointScore[]
}

export interface GhostFrame {
  /** ms timestamp (performance.now basis). */
  at: number
  landmarks: PoseLandmarks
}

/** Post-session structured payload (also fed to the coach-LLM prompt). */
export interface ClashReport {
  mode: ClashMode
  referenceName: string
  rival: string
  startedAt: number
  endedAt: number
  durationMs: number
  avgAccuracy: number
  peakAccuracy: number
  /** Best (lowest) user→ghost sync offset observed, ms. */
  peakSyncMs: number
  strikes: Partial<Record<StrikeKind, number>>
  defects: string[]
  samples: number
}
