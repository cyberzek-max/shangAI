import { LM, type JointAngles, type PoseLandmarks } from '../types'

/**
 * Forward-kinematics sketch that turns sparse joint-angle targets into a
 * viewable 33-point skeleton for the rival pane. This is a VISUAL reference
 * only — scoring always uses the numeric targets, never these landmarks.
 * Elbow placement is exact (rotation-chosen); shoulders/legs are approximate
 * frontal projections, which is all a mirror-ghost needs.
 */

const V = 0.95
const CX = 0.5

function p(x: number, y: number, z = 0): PoseLandmarks[number] {
  return { x, y, z, visibility: V }
}

function rot(vx: number, vy: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [vx * c - vy * s, vx * s + vy * c]
}

interface ArmSpec {
  sx: number
  sy: number
  m: number // -1 left (outward = -x), +1 right
  shoulder?: number
  elbow?: number
}

function armPoints(a: ArmSpec): { e: [number, number]; w: [number, number] } {
  const thS = ((a.shoulder ?? 15) * Math.PI) / 180
  const dx = a.m * Math.sin(thS)
  const dy = Math.cos(thS)
  const ex = a.sx + 0.13 * dx
  const ey = a.sy + 0.13 * dy
  // Elbow inner angle -> forearm direction; pick the higher (smaller-y) wrist.
  const thE = a.elbow ?? 170
  const esx = -dx
  const esy = -dy
  const [f1x, f1y] = rot(esx, esy, thE)
  const [f2x, f2y] = rot(esx, esy, -thE)
  const [fx, fy] = f1y <= f2y ? [f1x, f1y] : [f2x, f2y]
  return { e: [ex, ey], w: [ex + 0.13 * fx, ey + 0.13 * fy] }
}

export function skeletonFromTargets(
  targets: Partial<Record<keyof JointAngles, number>>,
): PoseLandmarks {
  const sy = 0.3
  const hy = 0.55
  const lArm = armPoints({ sx: 0.38, sy, m: -1, shoulder: targets.leftShoulder, elbow: targets.leftElbow })
  const rArm = armPoints({ sx: 0.62, sy, m: 1, shoulder: targets.rightShoulder, elbow: targets.rightElbow })

  // Legs: knee lift for bent knees, lateral step-out for lunges.
  const leg = (hx: number, m: number, knee?: number): { k: [number, number]; a: [number, number] } => {
    const thK = knee ?? 175
    const lift = ((180 - thK) / 180) * 0.17
    const out = thK < 140 ? ((140 - thK) / 180) * 0.1 : 0
    return {
      k: [hx + m * (0.01 + out), 0.72 - lift * 0.6],
      a: [hx + m * 0.02, 0.9 - lift * 1.4],
    }
  }
  const lLeg = leg(0.42, -1, targets.leftKnee)
  const rLeg = leg(0.58, 1, targets.rightKnee)

  const lms: PoseLandmarks = new Array(33)
  lms[LM.NOSE] = p(CX, 0.185)
  lms[1] = p(CX - 0.02, 0.175)
  lms[2] = p(CX - 0.025, 0.175)
  lms[3] = p(CX - 0.03, 0.175)
  lms[4] = p(CX + 0.02, 0.175)
  lms[5] = p(CX + 0.025, 0.175)
  lms[6] = p(CX + 0.03, 0.175)
  lms[7] = p(CX - 0.06, 0.19)
  lms[8] = p(CX + 0.06, 0.19)
  lms[9] = p(CX - 0.03, 0.21)
  lms[10] = p(CX + 0.03, 0.21)

  lms[LM.LEFT_SHOULDER] = p(0.38, sy)
  lms[LM.RIGHT_SHOULDER] = p(0.62, sy)
  lms[LM.LEFT_ELBOW] = p(lArm.e[0], lArm.e[1])
  lms[LM.RIGHT_ELBOW] = p(rArm.e[0], rArm.e[1])
  lms[LM.LEFT_WRIST] = p(lArm.w[0], lArm.w[1])
  lms[LM.RIGHT_WRIST] = p(rArm.w[0], rArm.w[1])
  lms[17] = p(lArm.w[0] - 0.01, lArm.w[1] + 0.01)
  lms[18] = p(lArm.w[0] - 0.01, lArm.w[1] + 0.01)
  lms[19] = p(lArm.w[0] - 0.02, lArm.w[1] + 0.01)
  lms[20] = p(lArm.w[0] - 0.02, lArm.w[1] + 0.01)
  lms[21] = p(lArm.w[0] + 0.01, lArm.w[1] + 0.01)
  lms[22] = p(lArm.w[0] + 0.01, lArm.w[1] + 0.01)

  lms[LM.LEFT_HIP] = p(0.42, hy)
  lms[LM.RIGHT_HIP] = p(0.58, hy)
  lms[LM.LEFT_KNEE] = p(lLeg.k[0], lLeg.k[1])
  lms[LM.RIGHT_KNEE] = p(rLeg.k[0], rLeg.k[1])
  lms[LM.LEFT_ANKLE] = p(lLeg.a[0], lLeg.a[1])
  lms[LM.RIGHT_ANKLE] = p(rLeg.a[0], rLeg.a[1])
  lms[29] = p(0.45, 0.93)
  lms[30] = p(0.55, 0.93)
  lms[31] = p(0.45, 0.95)
  lms[32] = p(0.55, 0.95)
  return lms
}

/** Reference-pose joints expressed as plain angle targets. */
export function poseTargets(
  joints: { joint: keyof JointAngles; target: number }[],
): Partial<Record<keyof JointAngles, number>> {
  const out: Partial<Record<keyof JointAngles, number>> = {}
  for (const j of joints) out[j.joint] = j.target
  return out
}
