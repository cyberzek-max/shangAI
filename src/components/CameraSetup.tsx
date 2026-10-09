import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { LM, type PoseLandmarks } from '../types'
import { MovementAnalyzer } from '../analysis/analyzer'
import { PoseService } from '../pose/poseService'
import { dist2d, get, midpoint } from '../pose/landmarks'
import { drawSkeleton } from './SkeletonOverlay'
import { useAppStore } from '../state/store'

function torsoOf(lms: PoseLandmarks | null): number {
  if (!lms) return 0
  return dist2d(
    midpoint(get(lms, LM.LEFT_SHOULDER), get(lms, LM.RIGHT_SHOULDER)),
    midpoint(get(lms, LM.LEFT_HIP), get(lms, LM.RIGHT_HIP)),
  )
}

export function CameraSetup() {
  const { go, settings, setSimulated } = useAppStore(
    useShallow((s) => ({
      go: s.go,
      settings: s.settings,
      setSimulated: s.setSimulated,
    })),
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const calibRef = useRef<number | null>(null)
  const lastTorsoRef = useRef(0.25)

  const [status, setStatus] = useState<'requesting' | 'ready' | 'error'>('requesting')
  const [detected, setDetected] = useState(false)
  const [confidence, setConfidence] = useState(0)
  const [calibrated, setCalibrated] = useState(false)
  const [hint, setHint] = useState('Position your whole body in the frame')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let raf = 0
    let stream: MediaStream | null = null
    const service = new PoseService()
    const analyzer = new MovementAnalyzer({ focusExercise: settings.selectedExercise })

    const start = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setError(
            'Webcam is blocked by the browser on insecure HTTP connections. Please access via HTTPS (e.g. https://<ip>:5173) or localhost.',
          )
          setStatus('error')
          return
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
        if (!alive) {
          for (const t of stream.getTracks()) t.stop()
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        await service.init()
        if (!alive) return
        setStatus('ready')

        let lastUi = 0
        const loop = () => {
          if (!alive) return
          const now = performance.now()
          const lms = service.detect(video, now)
          const result = analyzer.update(lms, 33)
          if (canvasRef.current) drawSkeleton(canvasRef.current, lms, true)
          const torso = torsoOf(lms)
          if (torso > 0) lastTorsoRef.current = torso

          if (now - lastUi > 250) {
            lastUi = now
            setDetected(result.detected)
            setConfidence(result.confidence)
            const calib = calibRef.current
            if (!result.detected) {
              setHint('Move back so your whole body is in frame')
            } else if (calib && torso > 0) {
              const ratio = torso / calib
              if (ratio < 0.8) setHint('You look far — step closer to the camera')
              else if (ratio > 1.35) setHint('You look close — step back')
              else setHint(result.feedback)
            } else {
              setHint(result.feedback)
            }
          }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (err) {
        if (!alive) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Camera unavailable')
      }
    }
    void start()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      if (stream) {
        for (const t of stream.getTracks()) t.stop()
      }
      service.close()
    }
    // Run once on mount; exercise focus changes apply in gameplay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const calibrate = () => {
    calibRef.current = lastTorsoRef.current || 0.25
    setCalibrated(true)
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-10 animate-fadeIn">
      {/* Header & Wayfinding */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <button
          onClick={() => go('home')}
          className="apple-press glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <span>←</span> Back to Menu
        </button>
        <span className="text-xs font-medium text-slate-400">Step 1 of 2 · Sensor Setup</span>
      </div>

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl">
          Camera Positioning & Calibration
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Stand 2–3 meters back. Keep your full body, head, and feet visible in the frame.
        </p>
      </div>

      {/* Viewport Frame */}
      <div className="relative mt-6 aspect-[4/3] w-full overflow-hidden rounded-3xl bg-slate-950 shadow-glass-elevated border border-white/10 ring-1 ring-white/5">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* Viewport Corner Reticles */}
        <div className="pointer-events-none absolute inset-4 border border-white/10 rounded-2xl" />

        {/* Floating Tracking Pill */}
        <div className="glass-pill absolute left-4 top-4 flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-xs shadow-lg">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${
              status === 'ready' && detected
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : status === 'ready'
                  ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                  : 'bg-rose-400 animate-pulse'
            }`}
          />
          <span className="font-medium text-slate-100">
            {status === 'requesting'
              ? 'Initializing MediaPipe AI…'
              : status === 'error'
                ? 'Camera access issue'
                : detected
                  ? `Body Locked (${Math.round(confidence * 100)}%)`
                  : 'Searching for Pose'}
          </span>
        </div>

        {/* Calibrated Badge */}
        {calibrated && (
          <div className="glass-pill absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border-emerald-400/30">
            <span>✓</span> Calibrated
          </div>
        )}
      </div>

      {/* Live Pose Guidance Bar */}
      <div className="mt-4 flex items-center justify-center">
        <div className="glass-surface-subtle inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-xs font-medium text-cyan-300 shadow-glass-sm">
          <span>💡</span>
          <span>{hint}</span>
        </div>
      </div>

      {/* Error Fallback Card */}
      {status === 'error' && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200 shadow-glass">
          <p className="font-semibold text-rose-300">Camera Unavailable</p>
          <p className="mt-1 text-xs text-rose-200/90">{error}</p>
          <button
            onClick={() => {
              setSimulated(true)
              go('select')
            }}
            className="apple-press mt-3 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-500"
          >
            Launch Demo (Simulated) Instead →
          </button>
        </div>
      )}

      {/* Bottom Action Dock */}
      <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-5">
        <button
          onClick={() => go('home')}
          className="apple-press glass-surface rounded-2xl px-5 py-3 text-xs font-semibold text-slate-300 hover:text-white"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={calibrate}
            disabled={status !== 'ready' || !detected}
            className="apple-press glass-surface rounded-2xl px-5 py-3 text-xs font-semibold text-violet-300 hover:text-violet-200 hover:border-violet-400/40 disabled:opacity-40"
          >
            {calibrated ? '◎ Recalibrate Torso' : '◎ Calibrate Pose'}
          </button>

          <button
            onClick={() => {
              setSimulated(false)
              go('select')
            }}
            disabled={status !== 'ready'}
            className="apple-press rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 px-6 py-3 text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(14,165,233,0.4)] hover:brightness-105 disabled:opacity-40"
          >
            Select Exercise →
          </button>
        </div>
      </div>
    </div>
  )
}
