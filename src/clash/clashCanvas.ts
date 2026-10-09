import type { JointAngles, PoseLandmarks } from '../types'
import type { MatchResult } from './types'

const SEGMENTS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [28, 30],
]

/** Which segment a scored joint colors. */
const JOINT_SEGMENT: Partial<Record<keyof JointAngles, [number, number]>> = {
  leftShoulder: [11, 13],
  rightShoulder: [12, 14],
  leftElbow: [13, 15],
  rightElbow: [14, 16],
  leftHip: [23, 25],
  rightHip: [24, 26],
  leftKnee: [25, 27],
  rightKnee: [26, 28],
  leftAnkle: [27, 29],
  rightAnkle: [28, 30],
}

/** Landmark index where the correction arrow is anchored per joint. */
const ARROW_AT: Partial<Record<keyof JointAngles, number>> = {
  leftShoulder: 15,
  rightShoulder: 16,
  leftElbow: 15,
  rightElbow: 16,
  leftHip: 27,
  rightHip: 28,
  leftKnee: 27,
  rightKnee: 28,
  leftAnkle: 29,
  rightAnkle: 30,
  trunkInclination: 0,
}

function setup(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.lineCap = 'round'
  return ctx
}

/**
 * User skeleton: dim base + green/red overdraw for scored joints + red
 * correction arrows on the worst defects. Arrow direction is a simple
 * vertical nudge (up = raise/straighten, down = lower/bend); the exact
 * instruction comes from the spoken + text cue alongside it.
 */
export function drawClashUser(
  canvas: HTMLCanvasElement,
  lms: PoseLandmarks | null,
  match: MatchResult | null,
  mirrored = true,
): void {
  const ctx = setup(canvas)
  if (!ctx || !lms || lms.length < 29) return
  const w = canvas.width
  const h = canvas.height
  const px = (x: number) => (mirrored ? (1 - x) * w : x * w)
  const py = (y: number) => y * h

  const stroke = (a: number, b: number, color: string, width: number, glow: string) => {
    const p = lms[a]
    const q = lms[b]
    if (!p || !q) return
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.shadowColor = glow
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(px(p.x), py(p.y))
    ctx.lineTo(px(q.x), py(q.y))
    ctx.stroke()
  }

  for (const [a, b] of SEGMENTS) stroke(a, b, 'rgba(79,214,224,0.28)', 5, 'transparent')
  if (match) {
    for (const j of match.joints) {
      const seg = JOINT_SEGMENT[j.joint]
      if (!seg) continue
      stroke(seg[0], seg[1], j.ok ? '#34d399' : '#f87171', 7, j.ok ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.8)')
    }
    // Dots on defect joints.
    ctx.fillStyle = '#f87171'
    ctx.shadowColor = 'rgba(248,113,113,0.9)'
    ctx.shadowBlur = 10
    for (const j of match.defects) {
      const idx = ARROW_AT[j.joint] ?? 0
      const pt = lms[idx]
      if (!pt) continue
      ctx.beginPath()
      ctx.arc(px(pt.x), py(pt.y), 9, 0, Math.PI * 2)
      ctx.fill()
    }
    // Correction arrows: up when the joint must open/rise, down to lower/bend.
    for (const j of match.defects) {
      const idx = ARROW_AT[j.joint] ?? 0
      const pt = lms[idx]
      if (!pt) continue
      const up = j.user < j.target
      const x = px(pt.x)
      const y0 = py(pt.y)
      const len = h * 0.09 * (up ? -1 : 1)
      ctx.strokeStyle = '#fbbf24'
      ctx.fillStyle = '#fbbf24'
      ctx.shadowColor = 'rgba(251,191,36,0.9)'
      ctx.shadowBlur = 8
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(x, y0)
      ctx.lineTo(x, y0 + len)
      ctx.stroke()
      const hy = y0 + len
      const s = up ? -1 : 1
      ctx.beginPath()
      ctx.moveTo(x, hy)
      ctx.lineTo(x - 7, hy - 10 * s)
      ctx.lineTo(x + 7, hy - 10 * s)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.shadowBlur = 0
}

/** Rival ghost skeleton in violet with a label banner. */
export function drawGhost(
  canvas: HTMLCanvasElement,
  lms: PoseLandmarks | null,
  label: string,
  mirrored = true,
): void {
  const ctx = setup(canvas)
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  if (lms && lms.length >= 29) {
    const px = (x: number) => (mirrored ? (1 - x) * w : x * w)
    const py = (y: number) => y * h
    ctx.strokeStyle = 'rgba(154,124,245,0.9)'
    ctx.lineWidth = 5
    ctx.shadowColor = 'rgba(154,124,245,0.8)'
    ctx.shadowBlur = 8
    ctx.beginPath()
    for (const [a, b] of SEGMENTS) {
      const p = lms[a]
      const q = lms[b]
      if (!p || !q) continue
      ctx.moveTo(px(p.x), py(p.y))
      ctx.lineTo(px(q.x), py(q.y))
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }
  // Label banner.
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  const bw = Math.min(w - 16, 34 + label.length * 8.5)
  ctx.fillRect(8, 8, bw, 26)
  ctx.fillStyle = '#c4b5fd'
  ctx.font = '600 15px Rajdhani, sans-serif'
  ctx.fillText(label.slice(0, 32), 16, 26)
}
