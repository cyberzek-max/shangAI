import { LM, type JointAngles, type PoseLandmarks } from '../types'
import { dist2d, get } from '../pose/landmarks'
import type { StrikeEvent, StrikeKind } from './types'

const JAB_SPEED = 1.2 // normalized-units/sec
const HOOK_LATERAL = 1.1
const KICK_SPEED = 1.6
const ELBOW_EXT_RATE = 60 // deg/sec
const Z_APPROACH_RATE = -0.3 // fist moving toward the camera, units/sec

const COOLDOWNS: Record<StrikeKind, number> = {
  jab: 700,
  cross: 700,
  hook: 900,
  kick: 1000,
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/**
 * Velocity-based strike detector (Mode B). Reads wrist/ankle speed plus
 * elbow/knee extension rate from the smoothed landmark stream. Conservative
 * thresholds + per-kind cooldowns keep idle sway from scoring as strikes.
 */
export class StrikeDetector {
  private prev: PoseLandmarks | null = null
  private prevT = 0
  private prevAngles: JointAngles | null = null
  private cd: Record<StrikeKind, number> = { jab: 0, cross: 0, hook: 0, kick: 0 }
  peakSpeed = 0

  reset(): void {
    this.prev = null
    this.prevAngles = null
    this.cd = { jab: 0, cross: 0, hook: 0, kick: 0 }
    this.peakSpeed = 0
  }

  update(lms: PoseLandmarks | null, angles: JointAngles, nowMs: number): StrikeEvent[] {
    const out: StrikeEvent[] = []
    if (!lms || !this.prev || !this.prevAngles || this.prevT <= 0) {
      this.prev = lms
      this.prevAngles = angles
      this.prevT = nowMs
      return out
    }
    const dt = Math.max(1, nowMs - this.prevT) / 1000
    if (dt > 0.5) {
      // Gap too large (tab switch); resync without scoring.
      this.prev = lms
      this.prevAngles = angles
      this.prevT = nowMs
      return out
    }

    const side = (wrist: number, elbow: keyof JointAngles) => {
      const w0 = get(this.prev, wrist)
      const w1 = get(lms, wrist)
      if (!w0 || !w1) return null
      const speed = dist2d(w0, w1) / dt
      const vx = (w1.x - w0.x) / dt
      const vy = (w1.y - w0.y) / dt
      const zRate = ((w1.z ?? 0) - (w0.z ?? 0)) / dt
      const elbowRate = (angles[elbow] - this.prevAngles![elbow]) / dt
      return { speed, vx, vy, zRate, elbowRate }
    }

    // Jab (left) / Cross (right): fast hand speed plus an extension cue.
    // Straight punches foreshorten in frontal 2D, so the elbow gate is
    // deliberately loose: unfolding (elbow rate) OR approaching (z rate).
    const l = side(LM.LEFT_WRIST, 'leftElbow')
    if (
      l &&
      nowMs > this.cd.jab &&
      l.speed > JAB_SPEED &&
      (l.elbowRate > ELBOW_EXT_RATE || l.zRate < Z_APPROACH_RATE)
    ) {
      this.cd.jab = nowMs + COOLDOWNS.jab
      out.push(this.make('jab', nowMs, l.speed, clamp01((l.speed - JAB_SPEED) / 2.2)))
    }
    const r = side(LM.RIGHT_WRIST, 'rightElbow')
    if (
      r &&
      nowMs > this.cd.cross &&
      r.speed > JAB_SPEED &&
      (r.elbowRate > ELBOW_EXT_RATE || r.zRate < Z_APPROACH_RATE)
    ) {
      this.cd.cross = nowMs + COOLDOWNS.cross
      out.push(this.make('cross', nowMs, r.speed, clamp01((r.speed - JAB_SPEED) / 2.2)))
    }

    // Hook: lateral-dominant swing with a bent elbow (either arm).
    const hookArm =
      l && angles.leftElbow < 135 ? l : r && angles.rightElbow < 135 ? r : null
    if (
      hookArm &&
      nowMs > this.cd.hook &&
      hookArm.speed > 1.2 &&
      Math.abs(hookArm.vx) > HOOK_LATERAL &&
      Math.abs(hookArm.vx) > 1.4 * Math.abs(hookArm.vy)
    ) {
      this.cd.hook = nowMs + COOLDOWNS.hook
      out.push(this.make('hook', nowMs, hookArm.speed, clamp01((hookArm.speed - 1.2) / 2.4)))
    }

    // Roundhouse kick: fast rising foot that clears hip height (either leg).
    // Frontal 2D knee angles barely open for lateral kicks, so foot height —
    // not knee extension — is the honest trigger here.
    for (const [ankle, hip] of [
      [LM.LEFT_ANKLE, LM.LEFT_HIP],
      [LM.RIGHT_ANKLE, LM.RIGHT_HIP],
    ] as const) {
      const a0 = get(this.prev, ankle)
      const a1 = get(lms, ankle)
      const h1 = get(lms, hip)
      if (!a0 || !a1 || !h1) continue
      const speed = dist2d(a0, a1) / dt
      const vy = (a1.y - a0.y) / dt
      if (nowMs > this.cd.kick && speed > KICK_SPEED && vy < -0.7 && a1.y < h1.y) {
        this.cd.kick = nowMs + COOLDOWNS.kick
        out.push(this.make('kick', nowMs, speed, clamp01((speed - KICK_SPEED) / 2.4)))
        break
      }
    }

    this.prev = lms
    this.prevAngles = angles
    this.prevT = nowMs
    return out
  }

  private make(kind: StrikeKind, at: number, speed: number, quality: number): StrikeEvent {
    this.peakSpeed = Math.max(this.peakSpeed, speed)
    return { kind, at, quality: Math.max(0.35, Math.min(1, quality)), speed }
  }
}
