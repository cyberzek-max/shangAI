import type { JointAngles } from '../types'
import type { JointScore, MatchResult, ReferencePose } from './types'

export const JOINT_NAMES: Record<keyof JointAngles, string> = {
  leftElbow: 'Left elbow',
  rightElbow: 'Right elbow',
  leftShoulder: 'Left shoulder',
  rightShoulder: 'Right shoulder',
  leftHip: 'Left hip',
  rightHip: 'Right hip',
  leftKnee: 'Left knee',
  rightKnee: 'Right knee',
  leftAnkle: 'Left ankle',
  rightAnkle: 'Right ankle',
  trunkInclination: 'Back',
}

/** Cosine similarity of two equal-length vectors, mapped to 0..1. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  const cos = Math.max(-1, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb))))
  return (cos + 1) / 2
}

/** Mean-normalized Euclidean similarity, 0..1 (1 = identical). */
export function euclideanSimilarity(a: number[], b: number[], scale = 180): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]) / scale
  return Math.max(0, 1 - sum / a.length)
}

function scoreJoint(user: number, target: number, tol: number): JointScore | null {
  if (!Number.isFinite(user) || !Number.isFinite(target)) return null
  const err = Math.abs(user - target)
  const score = Math.max(0, Math.min(1, 1 - err / (2 * tol)))
  return { joint: '' as JointScore['joint'], user, target, score, ok: err <= tol }
}

/**
 * Mode A scoring: compare user angles to a static reference pose.
 * Blend of per-joint tolerance scoring + whole-vector cosine similarity.
 */
export function scoreFlow(angles: JointAngles, pose: ReferencePose): MatchResult {
  const joints: JointScore[] = []
  for (const t of pose.joints) {
    const s = scoreJoint(angles[t.joint], t.target, t.tol)
    if (s) joints.push({ ...s, joint: t.joint })
  }
  if (joints.length === 0) return { accuracy: 0, joints, defects: [] }
  const mean = joints.reduce((a, j) => a + j.score, 0) / joints.length
  const cos = cosineSimilarity(
    joints.map((j) => j.user),
    joints.map((j) => j.target),
  )
  const accuracy = Math.round((0.7 * mean + 0.3 * cos) * 100)
  const defects = joints
    .filter((j) => !j.ok)
    .sort((a, b) => Math.abs(b.user - b.target) - Math.abs(a.user - a.target))
    .slice(0, 3)
  return { accuracy, joints, defects }
}

const ACTION_TOL = 22

/**
 * Mode B scoring: compare user angles to sparse ghost-combo targets.
 * Uses Euclidean similarity blended with tolerance scoring.
 */
export function scoreAction(
  angles: JointAngles,
  targets: Partial<Record<keyof JointAngles, number>>,
): MatchResult {
  const joints: JointScore[] = []
  for (const key of Object.keys(targets) as (keyof JointAngles)[]) {
    const s = scoreJoint(angles[key], targets[key] as number, ACTION_TOL)
    if (s) joints.push({ ...s, joint: key })
  }
  if (joints.length === 0) return { accuracy: 0, joints, defects: [] }
  const mean = joints.reduce((a, j) => a + j.score, 0) / joints.length
  const euc = euclideanSimilarity(
    joints.map((j) => j.user),
    joints.map((j) => j.target),
  )
  const accuracy = Math.round((0.6 * mean + 0.4 * euc) * 100)
  const defects = joints
    .filter((j) => !j.ok)
    .sort((a, b) => Math.abs(b.user - b.target) - Math.abs(a.user - a.target))
    .slice(0, 3)
  return { accuracy, joints, defects }
}

/** Human-readable defect, e.g. "Left shoulder 22° below target during Warrior II". */
export function defectLabel(j: JointScore, context: string): string {
  const name = JOINT_NAMES[j.joint] ?? j.joint
  const delta = Math.round(j.user - j.target)
  const dir = delta > 0 ? 'above' : 'below'
  return `${name} ${Math.abs(delta)}° ${dir} target during ${context}`
}
