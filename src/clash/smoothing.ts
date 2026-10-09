import type { Landmark, PoseLandmarks } from '../types'

/**
 * Frame-buffer smoothing for landmark streams.
 * A short moving average suppresses high-speed jitter / motion-blur noise
 * before angles are computed. Flow mode uses a longer window (stability),
 * action mode a shorter one (responsiveness).
 */
export class LandmarkSmoother {
  private buf: PoseLandmarks[] = []
  constructor(private window = 3) {}

  setWindow(n: number): void {
    this.window = Math.max(1, Math.min(8, Math.round(n)))
    while (this.buf.length > this.window) this.buf.shift()
  }

  reset(): void {
    this.buf = []
  }

  /** Push a frame; returns the smoothed landmarks (or null passthrough). */
  push(lms: PoseLandmarks | null): PoseLandmarks | null {
    if (!lms) {
      this.buf = []
      return null
    }
    this.buf.push(lms)
    if (this.buf.length > this.window) this.buf.shift()
    const len = Math.max(...this.buf.map((b) => b.length))
    const out: PoseLandmarks = []
    for (let i = 0; i < len; i++) {
      let x = 0
      let y = 0
      let z = 0
      let v = 0
      let c = 0
      for (const b of this.buf) {
        const p: Landmark | undefined = b[i]
        if (!p) continue
        x += p.x
        y += p.y
        z += p.z
        v += p.visibility ?? 0
        c++
      }
      out.push({ x: x / Math.max(1, c), y: y / Math.max(1, c), z: z / Math.max(1, c), visibility: c ? v / c : 0 })
    }
    return out
  }
}
