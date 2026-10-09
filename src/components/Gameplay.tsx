import { lazy, Suspense, useEffect, useReducer, useRef, useState } from 'react'
import { sound } from '../audio/sound'
import { SessionRuntime } from '../game/runtime'
import type { GameEngine } from '../game/engine'
import { drawSkeleton } from './SkeletonOverlay'
import type { FramePose } from '../three/ArenaScene'
import { applySession } from '../state/storage'
import { useAppStore } from '../state/store'
import { useShallow } from 'zustand/react/shallow'
import type { SessionStats } from '../types'

const ArenaScene = lazy(() =>
  import('../three/ArenaScene').then((module) => ({ default: module.ArenaScene })),
)

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function Bar({
  value,
  max,
  tone,
  label,
}: {
  value: number
  max: number
  tone: 'cyan' | 'violet' | 'red' | 'green'
  label: string
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  const colors = {
    cyan: 'from-cyan-400 to-cyan-500',
    violet: 'from-violet-400 to-violet-500',
    red: 'from-red-500 to-rose-500',
    green: 'from-emerald-400 to-emerald-500',
  } as const
  return (
    <div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-slate-300">
        <span>{label}</span>
        <span>
          {Math.round(value)}/{max}
        </span>
      </div>
      <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-base-700/80">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors[tone]} transition-all duration-200`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function Gameplay() {
  const { settings, practice, setHud, go, setLastStats, progress, setProgress } =
    useAppStore(
      useShallow((s) => ({
        settings: s.settings,
        practice: s.practice,
        setHud: s.setHud,
        go: s.go,
        setLastStats: s.setLastStats,
        progress: s.progress,
        setProgress: s.setProgress,
      })),
    )
  const hud = useAppStore((s) => s.hud)

  const videoRef = useRef<HTMLVideoElement>(null)
  const pipCanvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<SessionRuntime | null>(null)
  const poseApiRef = useRef<FramePose>({
    depth: 0,
    squatDepth: 0,
    leftUp: false,
    rightUp: false,
    bothUp: false,
  })
  const engineRef = useRef<GameEngine | null>(null)
  const [, force] = useReducer((x: number) => x + 1, 0)
  const lastSound = useRef({ reps: -1, enemyHp: -1, action: null as string | null, status: '' })
  const progressRef = useRef(progress)
  progressRef.current = progress

  const [paused, setPaused] = useState(false)
  const [camError, setCamError] = useState<string | null>(null)

  const handleFinish = (stats: SessionStats) => {
    const next = applySession(progressRef.current, stats)
    setProgress(next)
    setLastStats(stats)
    go('results')
  }

  useEffect(() => {
    sound.setEnabled(settings.sound)
    const runtime = new SessionRuntime({
      video: videoRef.current,
      focusExercise: settings.selectedExercise,
      difficulty: settings.difficulty,
      maxIntensity: settings.maxIntensity,
      passive: practice,
      onHud: (h) => setHud(h),
      onPose: (result) => {
        poseApiRef.current = {
          depth: result.depth,
          squatDepth: result.squatDepth,
          leftUp: result.arms.leftUp,
          rightUp: result.arms.rightUp,
          bothUp: result.arms.bothUp,
        }
        if (pipCanvasRef.current) drawSkeleton(pipCanvasRef.current, result.landmarks, true)
      },
      onFinish: handleFinish,
      onCameraError: (msg) => setCamError(msg),
    })
    runtimeRef.current = runtime
    engineRef.current = runtime.gameEngine
    force()
    runtime.start().catch(() => {
      // onCameraError already surfaced the message.
    })
    return () => {
      runtimeRef.current?.stop('quit')
      runtimeRef.current = null
    }
    // Boot once per mount; restart remounts via key from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sound effects driven by HUD deltas.
  useEffect(() => {
    const p = lastSound.current
    if (hud.reps > p.reps) sound.rep()
    if (p.enemyHp >= 0 && hud.enemyHp < p.enemyHp) sound.hit()
    if (hud.lastAction && hud.lastAction !== p.action) {
      if (hud.lastAction === 'special') sound.special()
      else if (hud.lastAction === 'shield') sound.shield()
      else if (hud.lastAction === 'dodge') sound.dodge()
      else if (hud.lastAction === 'charge') sound.charge()
    }
    if (hud.status === 'victory' && p.status !== 'victory') sound.victory()
    if (hud.status === 'gameover' && p.status !== 'gameover') sound.gameover()
    lastSound.current = {
      reps: hud.reps,
      enemyHp: hud.enemyHp,
      action: hud.lastAction,
      status: hud.status,
    }
  }, [hud])

  const togglePause = () => {
    const rt = runtimeRef.current
    if (!rt) return
    if (paused) {
      rt.resume()
      setPaused(false)
    } else {
      rt.pause()
      setPaused(true)
    }
  }

  const quit = () => {
    runtimeRef.current?.stop('quit')
  }

  const enemyPct = hud.enemyMaxHp > 0 ? hud.enemyHp / hud.enemyMaxHp : 0

  return (
    <div className="relative h-screen w-full overflow-hidden bg-base-950 font-sans select-none">
      {engineRef.current ? (
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-slate-400">
              <div className="glass-pill flex items-center gap-3 rounded-2xl px-6 py-3">
                <span className="animate-spin text-cyan-400">⚡</span>
                <span className="text-sm font-medium">Loading 3D Arena…</span>
              </div>
            </div>
          }
        >
          <ArenaScene engine={engineRef.current} poseRef={poseApiRef} />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          <div className="glass-pill flex items-center gap-3 rounded-2xl px-6 py-3">
            <span className="animate-spin text-cyan-400">⚡</span>
            <span className="text-sm font-medium">Entering 3D Arena…</span>
          </div>
        </div>
      )}

      {/* Floating Top Dynamic HUD */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 p-3 sm:p-4">
        <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3">
          {/* Player Vitality Glass Card */}
          <div className="glass-surface pointer-events-auto flex flex-col gap-2 rounded-2xl p-3 shadow-glass w-56 sm:w-64">
            <Bar value={hud.playerHp} max={hud.playerMaxHp} tone="green" label="Health" />
            <Bar value={hud.energy} max={hud.maxEnergy} tone="cyan" label="Energy" />

            {(hud.shieldMs > 0 || hud.invulnMs > 0) && (
              <div className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                <span>{hud.shieldMs > 0 ? '🛡 Barrier Active' : '💨 Evading'}</span>
              </div>
            )}
          </div>

          {/* Central Score & Control Capsule */}
          <div className="glass-surface pointer-events-auto flex flex-col items-center rounded-2xl px-5 py-2.5 shadow-glass">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-[-0.02em] text-white sm:text-2xl">
                {hud.score.toLocaleString()}
              </span>
              {hud.combo > 1 && (
                <span className="rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                  {hud.combo}x COMBO
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300 mt-0.5">
              <span>{fmtTime(hud.timeMs)}</span>
              <span className="text-slate-500">·</span>
              <span className="font-semibold text-cyan-400">{hud.reps} reps</span>
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <button
                onClick={togglePause}
                className="apple-press glass-pill rounded-lg px-2.5 py-1 text-[10px] font-semibold text-slate-200 hover:text-white"
              >
                {paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={quit}
                className="apple-press glass-pill rounded-lg px-2.5 py-1 text-[10px] font-semibold text-slate-400 hover:text-rose-300"
              >
                ✕ End
              </button>
            </div>
          </div>

          {/* Boss / Enemy Target Glass Card */}
          <div className="glass-surface pointer-events-auto flex flex-col gap-1 rounded-2xl p-3 shadow-glass w-56 sm:w-64">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-300">
              <span className="truncate">👾 {hud.enemyName || 'Hostile Wraith'}</span>
              <span className="font-mono">{Math.round(hud.enemyHp)}/{hud.enemyMaxHp}</span>
            </div>
            <div className="mt-0.5 h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-200"
                style={{ width: `${Math.max(0, enemyPct * 100)}%` }}
              />
            </div>
            {hud.enemyWindup > 0.05 && (
              <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse">
                <span>⚠</span>
                <span>ATTACK INCOMING — DODGE!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Picture-in-Picture Webcam (Top Right floating under HUD) */}
      <div className="glass-surface absolute right-4 top-28 aspect-[4/3] w-36 overflow-hidden rounded-2xl shadow-glass sm:w-48 ring-1 ring-white/10">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={pipCanvasRef} width={640} height={480} className="absolute inset-0 h-full w-full" />
          <div className="glass-pill absolute bottom-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold text-white">
            {hud.detected ? 'Tracking Active' : 'Align Body'}
          </div>
      </div>

      {/* Live Form Guidance Capsule (Bottom Left) */}
      <div className="glass-surface pointer-events-none absolute bottom-4 left-4 w-72 rounded-2xl p-3.5 shadow-glass">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <span>Form Guidance</span>
          <span className="text-cyan-400">{hud.detected ? `${Math.round(hud.confidence * 100)}% Lock` : 'Searching'}</span>
        </div>
        <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-cyan-200">
          {hud.feedback || 'Perform steady repetitions'}
        </p>

        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-slate-400 font-medium mb-0.5">
            <span>Rep Depth</span>
            <span>{Math.round(hud.depth * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-150"
              style={{ width: `${Math.round(hud.depth * 100)}%` }}
            />
          </div>
        </div>

        {hud.lastAction && (
          <div className="mt-2 text-[10px] text-violet-300 font-medium">
            ⚡ Action: <span className="font-semibold">{hud.lastAction}</span>
          </div>
        )}
      </div>

      {/* Combat Feed (Bottom Right) */}
      <div className="pointer-events-none absolute bottom-4 right-4 flex w-64 flex-col items-end gap-1.5">
        {hud.events.slice(-4).map((e) => (
          <div
            key={e.id}
            className={`glass-surface-subtle animate-sheetSlideUp rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm ${
              e.tone === 'good' ? 'text-emerald-300 border-emerald-400/30' : e.tone === 'bad' ? 'text-rose-300 border-rose-400/30' : 'text-slate-200'
            }`}
          >
            {e.text}
          </div>
        ))}
      </div>

      {/* Pause Modal Sheet */}
      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl animate-fadeIn">
          <div className="glass-surface w-full max-w-sm rounded-3xl p-6 text-center shadow-glass-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
              ⏸
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-[-0.02em] text-white">Session Paused</h3>
            <p className="mt-1 text-xs text-slate-300">Take a breath. Your combat progress is held.</p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={togglePause}
                className="apple-press rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3 text-xs font-bold text-base-950 shadow-md hover:brightness-105"
              >
                Resume Battle
              </button>
              <button
                onClick={quit}
                className="apple-press glass-surface rounded-xl py-3 text-xs font-semibold text-slate-300 hover:text-white"
              >
                End & Save Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Error Modal */}
      {camError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
          <div className="glass-surface max-w-md rounded-3xl p-6 text-center shadow-glass-elevated border-rose-500/30">
            <h3 className="text-lg font-bold text-rose-300">Camera Interrupted</h3>
            <p className="mt-2 text-xs text-slate-300">{camError}</p>
            <button
              onClick={quit}
              className="apple-press mt-5 rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white"
            >
              Return to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
