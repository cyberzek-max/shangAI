import { useEffect, useRef } from 'react'
import type { PoseLandmarks } from '../types'

const CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [28, 30],
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
]

export function drawSkeleton(
  canvas: HTMLCanvasElement,
  lms: PoseLandmarks | null,
  mirrored = true,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  if (!lms || lms.length < 29) return

  const px = (x: number) => (mirrored ? (1 - x) * w : x * w)
  const py = (y: number) => y * h

  ctx.lineWidth = Math.max(2, w / 220)
  ctx.lineCap = 'round'
  ctx.strokeStyle = 'rgba(79,214,224,0.9)'
  ctx.shadowColor = 'rgba(79,214,224,0.8)'
  ctx.shadowBlur = 8

  ctx.beginPath()
  for (const [a, b] of CONNECTIONS) {
    const p = lms[a]
    const q = lms[b]
    if (!p || !q) continue
    ctx.moveTo(px(p.x), py(p.y))
    ctx.lineTo(px(q.x), py(q.y))
  }
  ctx.stroke()

  ctx.shadowBlur = 6
  ctx.fillStyle = '#9a7cf5'
  for (const [a, b] of CONNECTIONS) {
    for (const i of [a, b]) {
      const p = lms[i]
      if (!p) continue
      ctx.beginPath()
      ctx.arc(px(p.x), py(p.y), Math.max(2.5, w / 160), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

export function SkeletonOverlay({
  landmarks,
  mirrored = true,
}: {
  landmarks: PoseLandmarks | null
  mirrored?: boolean
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) drawSkeleton(ref.current, landmarks, mirrored)
  }, [landmarks, mirrored])
  return (
    <canvas
      ref={ref}
      width={640}
      height={480}
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
