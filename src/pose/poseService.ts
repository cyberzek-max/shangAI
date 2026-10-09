import {
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type { PoseLandmarks } from '../types'

// Keep inference assets same-origin: deployments remain reliable when third-party
// CDNs are blocked, and camera frames stay entirely in the browser.
const WASM_ROOT = '/wasm'
const MODEL_URL = '/models/pose_landmarker_lite.task'

export type PoseStatus = 'idle' | 'loading' | 'ready' | 'running' | 'error'

/**
 * Thin wrapper around MediaPipe Tasks Vision PoseLandmarker.
 * Kept isolated from game logic so tracking can be tuned independently.
 */
export class PoseService {
  private landmarker: PoseLandmarker | null = null
  private lastVideoTime = -1
  status: PoseStatus = 'idle'
  error: string | null = null

  async init(): Promise<void> {
    if (this.landmarker) return
    this.status = 'loading'
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      this.status = 'ready'
    } catch (err) {
      // Fall back to CPU delegate if GPU is unavailable (older devices).
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)
        this.landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        this.status = 'ready'
      } catch (err2) {
        this.status = 'error'
        this.error = err2 instanceof Error ? err2.message : String(err2)
        throw err2
      }
    }
  }

  /**
   * Detect pose for the given video frame. Returns normalized landmarks or null.
   * Uses the video timestamp to avoid re-processing the same frame.
   */
  detect(video: HTMLVideoElement, timestampMs: number): PoseLandmarks | null {
    if (!this.landmarker || video.readyState < 2) return null
    if (video.currentTime === this.lastVideoTime) return null
    this.lastVideoTime = video.currentTime
    this.status = 'running'
    let result: PoseLandmarkerResult
    try {
      result = this.landmarker.detectForVideo(video, timestampMs)
    } catch {
      return null
    }
    const lms = result.landmarks?.[0]
    return lms ? (lms as PoseLandmarks) : null
  }

  close(): void {
    this.landmarker?.close()
    this.landmarker = null
    this.status = 'idle'
  }
}
