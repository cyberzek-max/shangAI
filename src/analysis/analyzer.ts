import {
  LM,
  type AngleRule,
  type ExerciseId,
  type PoseAnalysisResult,
  type PoseLandmarks,
  type RepEvent,
} from '../types'
import { dist2d, get, midpoint, poseConfidence } from '../pose/landmarks'
import { computeAngles } from './angles'
import { EXERCISES, EXERCISE_LIST } from './exercises'
import { RepCounter, type RepState } from './repCounter'

const MIN_CONFIDENCE = 0.5
const HOLD_MS = 700

function cueFor(rule: AngleRule, depth: number, active: boolean): string {
  const cues = rule.cues
  if (!cues) return ''
  if (active && depth < 0.75) return cues.deepen
  if (active) return cues.good
  return cues.relax
}

export interface AnalyzerOptions {
  focusExercise: ExerciseId
  /** Confidence below which movements are not scored. */
  minConfidence?: number
}

/**
 * Converts raw landmarks into joint angles, per-exercise rep counts, feedback
 * and the higher-level flags the game mapping consumes. Pure and webcam-free.
 */
export class MovementAnalyzer {
  private counters: Record<ExerciseId, RepCounter>
  private focus: ExerciseId
  private minConfidence: number
  private holdMs = 0

  constructor(opts: AnalyzerOptions) {
    this.focus = opts.focusExercise
    this.minConfidence = opts.minConfidence ?? MIN_CONFIDENCE
    this.counters = {} as Record<ExerciseId, RepCounter>
    for (const def of EXERCISE_LIST) this.counters[def.id] = new RepCounter(def)
  }

  setFocusExercise(ex: ExerciseId): void {
    this.focus = ex
  }

  reset(): void {
    for (const c of Object.values(this.counters)) c.reset()
    this.holdMs = 0
  }

  update(lms: PoseLandmarks | null, dtMs: number): PoseAnalysisResult {
    const confidence = poseConfidence(lms)
    const detected = confidence >= this.minConfidence
    const angles = computeAngles(lms)

    const validForm =
      detected &&
      Number.isFinite(angles.trunkInclination) &&
      angles.trunkInclination < 45

    const repEvents: RepEvent[] = []
    let focusState: RepState = {
      depth: 0,
      phase: 'neutral',
      repCompleted: false,
      repNumber: 0,
      peakDepth: 0,
    }

    // Body-size reference used by custom metrics (e.g. knee-lift height).
    const LS0 = get(lms, LM.LEFT_SHOULDER)
    const RS0 = get(lms, LM.RIGHT_SHOULDER)
    const LH0 = get(lms, LM.LEFT_HIP)
    const RH0 = get(lms, LM.RIGHT_HIP)
    const torsoRef = dist2d(midpoint(LS0, RS0), midpoint(LH0, RH0)) || 0.25
    const ctx = { landmarks: lms, torso: torsoRef }

    // Only score when the pose is reliable.
    if (detected) {
      for (const def of EXERCISE_LIST) {
        const state = this.counters[def.id].update(angles, ctx)
        if (def.id === this.focus) focusState = state
        if (state.repCompleted && validForm) {
          repEvents.push({
            exercise: def.id,
            quality: Math.max(0.4, Math.min(1, state.peakDepth)),
            repNumber: state.repNumber,
          })
        }
      }
    } else {
      // Keep the focus depth at zero when the pose is unreliable.
      focusState = { depth: 0, phase: 'neutral', repCompleted: false, repNumber: this.counters[this.focus].repNumber, peakDepth: 0 }
    }

    // Arm flags for pose-hold detection (wrist above shoulder).
    // Threshold is torso-relative so it adapts to body size and distance.
    const LS = get(lms, LM.LEFT_SHOULDER)
    const RS = get(lms, LM.RIGHT_SHOULDER)
    const LW = get(lms, LM.LEFT_WRIST)
    const RW = get(lms, LM.RIGHT_WRIST)
    const upMargin = Math.max(0.012, 0.14 * torsoRef)
    const leftUp = !!LS && !!LW && LW.y < LS.y - upMargin
    const rightUp = !!RS && !!RW && RW.y < RS.y - upMargin
    const bothUp = leftUp && rightUp

    if (bothUp && detected) {
      this.holdMs = Math.min(HOLD_MS, this.holdMs + dtMs)
    } else {
      this.holdMs = Math.max(0, this.holdMs - dtMs * 1.5)
    }
    const holdProgress = this.holdMs / HOLD_MS
    const holdActive = holdProgress >= 1

    const activeExercise = repEvents.length ? repEvents[0].exercise : this.dominantActive()

    const feedback = this.feedback(detected, validForm, focusState.phase, focusState.depth, repEvents.length > 0)

    return {
      landmarks: lms,
      detected,
      confidence,
      angles,
      exercise: this.focus,
      activeExercise,
      phase: focusState.phase,
      depth: focusState.depth,
      repCompleted: focusState.repCompleted,
      repCount: focusState.repNumber,
      repEvents,
      holdActive,
      holdProgress,
      arms: { leftUp, rightUp, bothUp },
      squatDepth: this.counters.squat.depthCache,
      kneeRaised: this.counters['knee-lift'].depthCache > 0.5,
      feedback,
      validForm,
    }
  }

  /** Find which exercise currently has the deepest in-progress motion. */
  private dominantActive(): ExerciseId | 'none' {
    let best: ExerciseId | 'none' = 'none'
    let bestDepth = 0.35
    for (const def of EXERCISE_LIST) {
      const d = this.counters[def.id].depthCache
      if (d > bestDepth) {
        bestDepth = d
        best = def.id
      }
    }
    return best
  }

  private feedback(
    detected: boolean,
    validForm: boolean,
    phase: string,
    depth: number,
    repCompleted: boolean,
  ): string {
    if (!detected) return 'Move back so your whole body is in frame'
    if (!validForm) return 'Keep your torso upright'
    if (repCompleted) return 'Rep counted!'
    const def = EXERCISES[this.focus]
    if (phase === 'neutral' && depth < 0.15) return 'Ready - begin the movement'
    return cueFor(def.primaryRule, depth, phase !== 'neutral') || 'Movement detected'
  }
}
