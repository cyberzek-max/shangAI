import { MovementAnalyzer } from '../analysis/analyzer'
import { GameEngine } from './engine'
import { PoseService } from '../pose/poseService'
import type {
  DifficultyId,
  ExerciseId,
  PoseAnalysisResult,
  SessionStats,
  Settings,
} from '../types'
import type { HudSnapshot } from '../state/store'

const HUD_INTERVAL_MS = 90

export interface RuntimeOptions {
  video: HTMLVideoElement | null
  focusExercise: ExerciseId
  difficulty: DifficultyId
  maxIntensity: Settings['maxIntensity']
  enemyName?: string
  passive?: boolean
  onHud: (hud: HudSnapshot) => void
  onPose?: (result: PoseAnalysisResult) => void
  onFinish: (stats: SessionStats) => void
  onCameraError?: (msg: string) => void
}

/**
 * Owns the camera pose loop -> MovementAnalyzer -> GameEngine -> HUD snapshots.
 */
export class SessionRuntime {
  private engine: GameEngine
  private analyzer: MovementAnalyzer
  private service = new PoseService()
  private opts: RuntimeOptions

  private raf = 0
  private last = 0
  private lastHud = 0
  private stream: MediaStream | null = null
  private qualities: number[] = []
  private confSum = 0
  private confFrames = 0
  private startedAt = 0
  private finished = false
  private latestFeedback = 'Initializing…'
  private latestDepth = 0
  private latestDetected = false
  private latestConfidence = 0
  running = false

  constructor(opts: RuntimeOptions) {
    this.opts = opts
    this.engine = new GameEngine(
      {
        difficulty: opts.difficulty,
        maxIntensity: opts.maxIntensity,
        enemyName: opts.enemyName,
        passive: opts.passive,
      },
      performance.now(),
    )
    this.analyzer = new MovementAnalyzer({ focusExercise: opts.focusExercise })
  }

  get gameEngine(): GameEngine {
    return this.engine
  }

  setFocusExercise(ex: ExerciseId): void {
    this.analyzer.setFocusExercise(ex)
  }

  pause(): void {
    this.engine.pause()
  }

  resume(): void {
    this.engine.resume()
  }

  async start(): Promise<void> {
    const { video } = this.opts
    if (!video) throw new Error('No video element for camera mode')
    if (!navigator?.mediaDevices?.getUserMedia) {
      const msg = 'Camera access requires HTTPS or localhost.'
      this.opts.onCameraError?.(msg)
      throw new Error(msg)
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      })
      video.srcObject = this.stream
      await video.play()
      await this.service.init()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera unavailable.'
      this.opts.onCameraError?.(msg)
      throw new Error(msg)
    }
    this.startedAt = performance.now()
    this.last = 0
    this.running = true
    this.engine.start(performance.now())
    this.raf = requestAnimationFrame(this.step)
  }

  private step = (): void => {
    if (!this.running) return
    const now = performance.now()
    const dt = this.last > 0 ? Math.min(100, now - this.last) : 16
    this.last = now

    const lms = this.opts.video ? this.service.detect(this.opts.video, now) : null

    const result = this.analyzer.update(lms, dt)
    this.engine.processPose(result, now)
    this.engine.tick(dt, now)

    for (const rep of result.repEvents) this.qualities.push(rep.quality)
    if (result.detected) {
      this.confSum += result.confidence
      this.confFrames++
    }
    this.latestFeedback = result.feedback
    this.latestDepth = result.depth
    this.latestDetected = result.detected
    this.latestConfidence = result.confidence

    this.opts.onPose?.(result)

    if (now - this.lastHud > HUD_INTERVAL_MS) {
      this.lastHud = now
      this.opts.onHud(this.buildHud())
    }

    const status = this.engine.state.status
    if (status === 'victory' || status === 'gameover') {
      this.finish(status)
      return
    }
    this.raf = requestAnimationFrame(this.step)
  }

  private buildHud(): HudSnapshot {
    const s = this.engine.state
    const interval = s.enemy.attackInterval
    return {
      status: s.status,
      playerHp: Math.round(s.player.hp),
      playerMaxHp: s.player.maxHp,
      energy: Math.round(s.player.energy),
      maxEnergy: s.player.maxEnergy,
      shieldMs: s.player.shieldMs,
      invulnMs: s.player.invulnMs,
      enemyHp: Math.round(s.enemy.hp),
      enemyMaxHp: s.enemy.maxHp,
      enemyName: s.enemy.name,
      enemyWindup: s.enemy.windup,
      enemyTimerRatio:
        interval > 0 ? Math.max(0, Math.min(1, s.enemy.attackTimer / interval)) : 0,
      score: s.score,
      combo: s.combo,
      xp: s.xp,
      level: s.level,
      timeMs: s.timeMs,
      reps: s.reps,
      feedback: this.latestFeedback,
      depth: this.latestDepth,
      detected: this.latestDetected,
      confidence: this.latestConfidence,
      adaptiveLevel: s.adaptiveLevel,
      lastAction: s.lastAction,
      events: s.events.map((e) => ({ id: e.id, text: e.text, tone: e.tone })),
    }
  }

  /** Stop the loop and camera; emits session stats (once). */
  stop(outcome: SessionStats['outcome'], silent = false): SessionStats | null {
    if (this.finished) return null
    this.finished = true
    this.running = false
    cancelAnimationFrame(this.raf)
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop()
      this.stream = null
    }
    this.service.close()

    const endedAt = Date.now()
    const avgConfidence = this.confFrames > 0 ? this.confSum / this.confFrames : 0
    const avgConsistency = this.consistency(avgConfidence)
    const counts = this.engine.exerciseCounts()
    const exerciseIds = Object.keys(counts) as ExerciseId[]
    if (!exerciseIds.includes(this.opts.focusExercise)) {
      exerciseIds.unshift(this.opts.focusExercise)
    }
    const stats: SessionStats = {
      startedAt: this.startedAt,
      endedAt,
      durationMs: this.engine.state.timeMs,
      reps: this.engine.state.reps,
      validReps: this.engine.state.validReps,
      score: this.engine.state.score,
      xpEarned: this.engine.state.xp,
      avgConsistency,
      avgConfidence,
      peakCombo: this.engine.state.peakCombo,
      difficulty: this.opts.difficulty,
      outcome,
      exerciseIds,
    }
    if (!silent) this.opts.onFinish(stats)
    return stats
  }

  private finish(outcome: 'victory' | 'gameover'): void {
    this.stop(outcome)
  }

  private consistency(avgConfidence: number): number {
    let repPart = 100
    if (this.qualities.length >= 2) {
      const mean = this.qualities.reduce((a, b) => a + b, 0) / this.qualities.length
      const variance =
        this.qualities.reduce((a, q) => a + (q - mean) * (q - mean), 0) /
        this.qualities.length
      repPart = Math.max(0, Math.min(100, 100 * (1 - 2 * Math.sqrt(variance))))
    } else if (this.qualities.length === 1) {
      repPart = Math.max(0, Math.min(100, this.qualities[0] * 100))
    }
    return Math.round(0.7 * repPart + 0.3 * avgConfidence * 100)
  }
}
