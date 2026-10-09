import { LM, type Landmark, type PoseLandmarks } from '../types'

export function get(lms: PoseLandmarks | null, index: number): Landmark | null {
  if (!lms || index < 0 || index >= lms.length) return null
  return lms[index] ?? null
}

/** Euclidean distance in the normalized image plane (ignores z). */
export function dist2d(a: Landmark | null, b: Landmark | null): number {
  if (!a || !b) return 0
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

export function midpoint(a: Landmark | null, b: Landmark | null): Landmark | null {
  if (!a || !b) return null
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
}

/**
 * Angle (degrees) at vertex `b` formed by segments b->a and b->c.
 * Works in the 2D image plane, which is sufficient for frontal rehab moves.
 */
export function angleAt(a: Landmark | null, b: Landmark | null, c: Landmark | null): number {
  if (!a || !b || !c) return NaN
  const abx = a.x - b.x
  const aby = a.y - b.y
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const magA = Math.hypot(abx, aby)
  const magC = Math.hypot(cbx, cby)
  if (magA === 0 || magC === 0) return NaN
  const cos = Math.max(-1, Math.min(1, dot / (magA * magC)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** Average visibility of a set of landmark indices (0..1). */
export function avgVisibility(lms: PoseLandmarks | null, indices: number[]): number {
  if (!lms) return 0
  let sum = 0
  let n = 0
  for (const i of indices) {
    const lm = lms[i]
    if (lm && typeof lm.visibility === 'number') {
      sum += lm.visibility
      n++
    }
  }
  return n === 0 ? 0 : sum / n
}

/**
 * Core landmark set whose visibility drives the confidence check.
 * If these are not reliably seen we must not score the movement.
 */
export const CORE_LANDMARKS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
]

export function poseConfidence(lms: PoseLandmarks | null): number {
  if (!lms || lms.length < 29) return 0
  return avgVisibility(lms, CORE_LANDMARKS)
}
