import type { ExerciseDef, JointAngles, MetricCtx, MovementPhase } from '../types'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

export interface RepState {
  depth: number
  phase: MovementPhase
  repCompleted: boolean
  repNumber: number
  peakDepth: number
}

/**
 * State-machine rep counter for one exercise.
 * Progresses relaxed -> active -> relaxed, counting a rep when the movement
 * reaches its active range and then returns to the relaxed range.
 */
export class RepCounter {
  readonly def: ExerciseDef
  private active = false
  private reachedActive = false
  private peak = 0
  private _repNumber = 0
  /** Last computed depth, cached for read-only consumers. */
  depthCache = 0

  constructor(def: ExerciseDef) {
    this.def = def
  }

  get repNumber(): number {
    return this._repNumber
  }

  reset(): void {
    this.active = false
    this.reachedActive = false
    this.peak = 0
    this._repNumber = 0
  }

  private value(angles: JointAngles, ctx: MetricCtx): number {
    if (this.def.primaryRule.getValue) {
      const v = this.def.primaryRule.getValue(angles, ctx)
      if (Number.isFinite(v)) return v
    }
    const v1 = angles[this.def.primaryRule.joint]
    if (this.def.secondaryRule) {
      const v2 = angles[this.def.secondaryRule.joint]
      if (Number.isFinite(v1) && Number.isFinite(v2)) return (v1 + v2) / 2
      return Number.isFinite(v1) ? v1 : v2
    }
    return v1
  }

  private depthOf(value: number): number {
    const r = this.def.primaryRule
    if (r.activeAbove) {
      return clamp01((value - r.relaxedThreshold) / (r.activeThreshold - r.relaxedThreshold))
    }
    return clamp01((r.relaxedThreshold - value) / (r.relaxedThreshold - r.activeThreshold))
  }

  update(angles: JointAngles, ctx: MetricCtx): RepState {
    const v = this.value(angles, ctx)
    const depth = Number.isFinite(v) ? this.depthOf(v) : 0
    this.depthCache = depth
    let repCompleted = false

    if (!this.active) {
      if (depth >= 1) {
        this.active = true
        this.reachedActive = true
        this.peak = 1
      }
    } else {
      if (depth > this.peak) this.peak = depth
      // Near the relaxed end: close the rep.
      if (depth <= 0.1) {
        this.active = false
        const completed = this.reachedActive
        const peak = this.peak
        this.reachedActive = false
        this.peak = 0
        if (completed) {
          this._repNumber += 1
          repCompleted = true
        }
        return { depth, phase: 'neutral', repCompleted, repNumber: this._repNumber, peakDepth: peak }
      }
    }

    const phase: MovementPhase = this.active
      ? this.def.primaryRule.activeAbove
        ? 'up'
        : 'down'
      : 'neutral'
    return { depth, phase, repCompleted, repNumber: this._repNumber, peakDepth: this.peak }
  }
}
