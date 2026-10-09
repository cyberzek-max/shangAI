import { angleAt, get } from '../pose/landmarks'
import { LM, type JointAngles, type Landmark } from '../types'

const DEG = 180 / Math.PI

/** Compute the joint angles used by the exercise evaluators. */
export function computeAngles(lms: Landmark[] | null): JointAngles {
  const LS = get(lms, LM.LEFT_SHOULDER)
  const RS = get(lms, LM.RIGHT_SHOULDER)
  const LE = get(lms, LM.LEFT_ELBOW)
  const RE = get(lms, LM.RIGHT_ELBOW)
  const LW = get(lms, LM.LEFT_WRIST)
  const RW = get(lms, LM.RIGHT_WRIST)
  const LH = get(lms, LM.LEFT_HIP)
  const RH = get(lms, LM.RIGHT_HIP)
  const LK = get(lms, LM.LEFT_KNEE)
  const RK = get(lms, LM.RIGHT_KNEE)
  const LA = get(lms, LM.LEFT_ANKLE)
  const RA = get(lms, LM.RIGHT_ANKLE)

  let trunkInclination = 0
  if (LS && RS && LH && RH) {
    const smx = (LS.x + RS.x) / 2
    const smy = (LS.y + RS.y) / 2
    const hmx = (LH.x + RH.x) / 2
    const hmy = (LH.y + RH.y) / 2
    // Deviation of the spine vector from vertical.
    trunkInclination = Math.abs(Math.atan2(smx - hmx, -(smy - hmy)) * DEG)
  }

  return {
    leftElbow: angleAt(LS, LE, LW),
    rightElbow: angleAt(RS, RE, RW),
    leftShoulder: angleAt(LE, LS, LH),
    rightShoulder: angleAt(RE, RS, RH),
    leftHip: angleAt(LS, LH, LK),
    rightHip: angleAt(RS, RH, RK),
    leftKnee: angleAt(LH, LK, LA),
    rightKnee: angleAt(RH, RK, RA),
    leftAnkle: angleAt(LK, LA, get(lms, 31)),
    rightAnkle: angleAt(RK, RA, get(lms, 32)),
    trunkInclination,
  }
}
