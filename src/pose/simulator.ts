import { LM, type Landmark, type PoseLandmarks } from '../types'

/**
 * DEMO MODE pose source.
 *
 * This is a clearly-labelled SIMULATION. It does NOT drive the game with a real
 * webcam; it fabricates plausible BlazePose-style landmarks so the gameplay,
 * scoring and adaptive systems can be demonstrated and unit-tested on machines
 * without a camera. The UI always shows a "SIMULATED" badge when this is active.
 */

const V = 0.96

function p(x: number, y: number, z = 0, visibility = V): Landmark {
  return { x, y, z, visibility }
}

export type SimExercise = 'squat' | 'arm-raise' | 'lateral-raise' | 'knee-lift'

interface SkeletonOpts {
  /** 0..1 squat depth (hips drop). */
  squat: number
  /** 0..1 raise of each wrist toward/above the shoulders. */
  armL: number
  armR: number
  /** 0..1 lateral abduction of each wrist. */
  latL: number
  latR: number
  /** 0..1 knee lift of the left knee. */
  kneeLift: number
  /** global body sway/noise phase. */
  t: number
}

const CENTER_X = 0.5

function buildSkeleton(o: SkeletonOpts): PoseLandmarks {
  const sway = Math.sin(o.t * 1.7) * 0.004
  const breathe = Math.sin(o.t * 2.1) * 0.003

  // Vertical body drop from squatting.
  const drop = o.squat * 0.13

  const shoulderY = 0.30 + drop * 0.9 + breathe
  const hipY = 0.55 + drop + breathe
  const kneeBaseY = 0.72 + drop * 0.55
  const ankleY = 0.90

  const lSh = p(CENTER_X - 0.12 + sway, shoulderY)
  const rSh = p(CENTER_X + 0.12 + sway, shoulderY)
  const lHip = p(CENTER_X - 0.08 + sway, hipY)
  const rHip = p(CENTER_X + 0.08 + sway, hipY)

  // Elbow/wrist with arm-raise and lateral-raise contributions.
  // Overhead: elbows rise above the shoulders and track inward.
  // Lateral: elbows rise to shoulder height and track outward.
  const elbowBaseY = 0.42
  const wristBaseY = 0.54

  const lElbowY = elbowBaseY + drop * 0.9 - o.armL * 0.18 - o.latL * 0.12
  const rElbowY = elbowBaseY + drop * 0.9 - o.armR * 0.18 - o.latR * 0.12
  const lWristY = wristBaseY + drop * 0.9 - o.armL * 0.34 - o.latL * 0.24
  const rWristY = wristBaseY + drop * 0.9 - o.armR * 0.34 - o.latR * 0.24

  const lElbowX = CENTER_X - 0.17 + sway - o.armL * 0.07 + o.latL * 0.08
  const rElbowX = CENTER_X + 0.17 + sway + o.armR * 0.07 - o.latR * 0.08
  const lWristX = CENTER_X - 0.20 + sway + o.armL * 0.15 - o.latL * 0.10
  const rWristX = CENTER_X + 0.20 + sway - o.armR * 0.15 + o.latR * 0.10

  // Knee lift raises the left knee toward hip height; the foot dangles below.
  const liftOffset = o.kneeLift * 0.17
  const lKnee = p(CENTER_X - 0.07 + sway + o.kneeLift * 0.02, kneeBaseY - liftOffset)
  const rKnee = p(CENTER_X + 0.07 + sway, kneeBaseY)
  const lAnkle = p(CENTER_X - 0.06 + sway, ankleY - o.kneeLift * 0.24)
  const rAnkle = p(CENTER_X + 0.06 + sway, ankleY)

  const lms: PoseLandmarks = new Array(33)
  // Face
  lms[LM.NOSE] = p(CENTER_X + sway, 0.185 + drop * 0.9)
  lms[1] = p(CENTER_X - 0.02 + sway, 0.175 + drop * 0.9) // left eye inner
  lms[LM.LEFT_EYE] = p(CENTER_X - 0.025 + sway, 0.175 + drop * 0.9)
  lms[3] = p(CENTER_X - 0.03 + sway, 0.175 + drop * 0.9) // left eye outer
  lms[4] = p(CENTER_X + 0.02 + sway, 0.175 + drop * 0.9)
  lms[LM.RIGHT_EYE] = p(CENTER_X + 0.025 + sway, 0.175 + drop * 0.9)
  lms[6] = p(CENTER_X + 0.03 + sway, 0.175 + drop * 0.9)
  lms[7] = p(CENTER_X - 0.06 + sway, 0.19 + drop * 0.9) // left ear
  lms[8] = p(CENTER_X + 0.06 + sway, 0.19 + drop * 0.9) // right ear
  lms[9] = p(CENTER_X - 0.03 + sway, 0.21 + drop * 0.9) // mouth left
  lms[10] = p(CENTER_X + 0.03 + sway, 0.21 + drop * 0.9) // mouth right

  // Arms
  lms[LM.LEFT_SHOULDER] = lSh
  lms[LM.RIGHT_SHOULDER] = rSh
  lms[LM.LEFT_ELBOW] = p(lElbowX, lElbowY)
  lms[LM.RIGHT_ELBOW] = p(rElbowX, rElbowY)
  lms[LM.LEFT_WRIST] = p(lWristX, lWristY)
  lms[LM.RIGHT_WRIST] = p(rWristX, rWristY)
  // Hands (pinky/index/thumb) approximated near the wrist.
  lms[17] = p(lWristX - 0.01, lWristY + 0.01)
  lms[18] = p(lWristX - 0.01, lWristY + 0.01)
  lms[19] = p(lWristX - 0.02, lWristY + 0.01)
  lms[20] = p(lWristX - 0.02, lWristY + 0.01)
  lms[21] = p(lWristX + 0.01, lWristY + 0.01)
  lms[22] = p(lWristX + 0.01, lWristY + 0.01)

  // Legs
  lms[LM.LEFT_HIP] = lHip
  lms[LM.RIGHT_HIP] = rHip
  lms[LM.LEFT_KNEE] = lKnee
  lms[LM.RIGHT_KNEE] = rKnee
  lms[LM.LEFT_ANKLE] = lAnkle
  lms[LM.RIGHT_ANKLE] = rAnkle
  lms[29] = p(CENTER_X - 0.05 + sway, 0.93)
  lms[30] = p(CENTER_X + 0.05 + sway, 0.93)
  lms[31] = p(CENTER_X - 0.05 + sway, 0.95)
  lms[32] = p(CENTER_X + 0.05 + sway, 0.95)

  return lms
}

/** Smooth 0->1->0 triangle-ish easing with a hold at the peak. */
function cycle(phase: number): number {
  const x = ((phase % 1) + 1) % 1
  if (x < 0.15) return 0
  if (x < 0.35) return (x - 0.15) / 0.2 // rise
  if (x < 0.6) return 1 // hold
  if (x < 0.8) return 1 - (x - 0.6) / 0.2 // fall
  return 0
}

export class PoseSimulator {
  private start = performance.now()
  private current: SimExercise = 'squat'
  /** Seconds spent on the current movement before switching. */
  private dwell = 6
  private exerciseOrder: SimExercise[] = [
    'squat',
    'arm-raise',
    'lateral-raise',
    'knee-lift',
  ]
  private orderIndex = 0

  setExercise(ex: SimExercise): void {
    this.current = ex
    this.orderIndex = this.exerciseOrder.indexOf(ex)
    this.start = performance.now()
  }

  get exercise(): SimExercise {
    return this.current
  }

  /** Produce the next frame of fabricated landmarks. */
  step(nowMs: number): PoseLandmarks {
    const elapsed = (nowMs - this.start) / 1000
    if (elapsed > this.dwell) {
      this.orderIndex = (this.orderIndex + 1) % this.exerciseOrder.length
      this.current = this.exerciseOrder[this.orderIndex]
      this.start = nowMs
    }
    const t = nowMs / 1000
    // A rep every ~1.6s: two phases per cycle.
    const phase = elapsed / 1.6
    const v = cycle(phase)
    const alternate = Math.floor(phase) % 2 === 0

    const o: SkeletonOpts = {
      squat: 0,
      armL: 0,
      armR: 0,
      latL: 0,
      latR: 0,
      kneeLift: 0,
      t,
    }

    switch (this.current) {
      case 'squat':
        o.squat = v
        break
      case 'arm-raise':
        o.armL = v
        o.armR = v * 0.85
        break
      case 'lateral-raise':
        o.latL = v
        o.latR = v
        break
      case 'knee-lift':
        o.kneeLift = v
        // Alternate a little sway so it looks less robotic.
        o.squat = alternate ? 0 : 0.02
        break
    }
    return buildSkeleton(o)
  }
}
