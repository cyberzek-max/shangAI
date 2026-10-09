import { useEffect, useRef, useState } from 'react'
import { computeAngles } from '../analysis/angles'
import { poseConfidence } from '../pose/landmarks'
import { PoseService } from '../pose/poseService'
import { PoseSimulator } from '../pose/simulator'
import { LandmarkSmoother } from '../clash/smoothing'
import { scoreAction, scoreFlow } from '../clash/scoring'
import { StrikeDetector } from '../clash/strikes'
import { GhostPlayer, loadGhosts, sampleCombo } from '../clash/ghost'
import { poseTargets, skeletonFromTargets } from '../clash/ghostSkeleton'
import { drawClashUser, drawGhost } from '../clash/clashCanvas'
import { coachVoice } from '../clash/coachAudio'
import { ClashRecorder } from '../clash/report'
import { getPose } from '../clash/referencePoses'
import { getCombo } from '../clash/ghostCombos'
import { getLivePeer } from '../net/peer'
import { useAppStore } from '../state/store'
import { useShallow } from 'zustand/react/shallow'
import type { MatchResult, StrikeKind } from '../clash/types'
import type { PoseLandmarks } from '../types'

interface Hud {
  accuracy: number
  detected: boolean
  conf: number
  timeLeft: number
  holdPct: number
  score: number
  strikes: number
  label: string
  ghostOk: boolean
  events: string[]
}

const KIND_IN_LABEL: Record<StrikeKind, string> = {
  jab: 'jab',
  cross: 'cross',
  hook: 'hook',
  kick: 'kick',
}

export function ClashSession() {
  const { go, clash, setClashReport } = useAppStore(
    useShallow((s) => ({
      go: s.go,
      clash: s.clash,
      setClashReport: s.setClashReport,
    })),
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const userCanvasRef = useRef<HTMLCanvasElement>(null)
  const ghostCanvasRef = useRef<HTMLCanvasElement>(null)
  const finishedRef = useRef(false)
  const pausedRef = useRef(false)
  // Pause accounting: session clocks run on shifted time so pausing truly freezes.
  const ctlRef = useRef({ pauseBegan: 0, accum: 0, resync: false })
  const [paused, setPaused] = useState(false)
  const [hud, setHud] = useState<Hud>({
    accuracy: 0, detected: false, conf: 0, timeLeft: clash.durationSec,
    holdPct: 0, score: 0, strikes: 0, label: 'Get ready…', ghostOk: false, events: [],
  })

  useEffect(() => {
    let alive = true
    let raf = 0
    let stream: MediaStream | null = null
    const service = new PoseService()
    const sim = new PoseSimulator()
    const smoother = new LandmarkSmoother(clash.mode === 'flow' ? 4 : 2)
    const detector = new StrikeDetector()
    const recorder = new ClashRecorder()
    const ghostPlayer = new GhostPlayer()
    const peer = clash.rival === 'live' ? getLivePeer() : null

    const pose = getPose(clash.poseId)
    const combo = getCombo(clash.comboId)
    const ghosts = loadGhosts()
    const recorded = ghosts.find((g) => g.id === clash.ghostId) ?? null

    const t0 = performance.now()
    const comboStart = t0
    ghostPlayer.load(recorded, t0)
    coachVoice.setEnabled(clash.voice)

    let holdBank = 0
    let score = 0
    let strikeCount = 0
    let lastHudPush = 0
    let lastSample = 0
    let lastDefectLog = 0
    let currentLabel = ''
    let labelSince = t0
    const events: string[] = []
    const pushEvent = (e: string) => {
      events.push(e)
      if (events.length > 4) events.shift()
    }

    const contextName = () => (clash.mode === 'flow' ? pose.name : combo.name)

    const finish = () => {
      if (finishedRef.current || !alive) return
      finishedRef.current = true
      cancelAnimationFrame(raf)
      if (stream) for (const t of stream.getTracks()) t.stop()
      service.close()
      const endedAt = Date.now()
      const rivalName =
        clash.rival === 'live'
          ? 'Live rival (P2P)'
          : clash.rival === 'recorded'
            ? `Ghost: ${recorded?.name ?? '?'}`
            : clash.rival === 'reference'
              ? `Ideal ghost: ${contextName()}`
              : 'Solo'
      const report = recorder.build({
        mode: clash.mode,
        referenceName: contextName(),
        rival: rivalName,
        startedAt: t0,
        endedAt,
        simulated: clash.simUser,
      })
      setClashReport(report)
      go('clash-report')
    }

    const boot = async () => {
      try {
        if (!clash.simUser) {
          const video = videoRef.current
          if (!video) throw new Error('No video element')
          if (!navigator?.mediaDevices?.getUserMedia) {
            throw new Error(
              'Webcam requires HTTPS or localhost. Please access via HTTPS or enable simulated mode.',
            )
          }
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false,
          })
          if (!alive) {
            for (const t of stream.getTracks()) t.stop()
            return
          }
          video.srcObject = stream
          await video.play()
          await service.init()
          if (!alive) return
        }
      } catch (err) {
        if (!alive) return
        pushEvent(err instanceof Error ? err.message : 'Camera failed')
        return
      }

      let last = performance.now()
      const loop = () => {
        if (!alive || finishedRef.current) return
        if (pausedRef.current) {
          raf = requestAnimationFrame(loop)
          return
        }
        const now = performance.now()
        const t = now - ctlRef.current.accum // session clock (frozen while paused)
        if (ctlRef.current.resync) {
          // Dropped frames during pause must not score as strikes.
          ctlRef.current.resync = false
          smoother.reset()
          detector.reset()
          last = now
        }
        const dt = Math.min(100, now - last)
        last = now
        const proc0 = performance.now()

        // --- user landmarks ---
        let raw: PoseLandmarks | null
        if (clash.simUser) raw = sim.step(now)
        else raw = videoRef.current ? service.detect(videoRef.current, now) : null
        const lms = smoother.push(raw)
        const angles = computeAngles(lms)
        const conf = poseConfidence(lms)
        const detected = conf >= 0.5
        if (peer) peer.send(lms, now)

        // --- rival landmarks ---
        let rivalLms: PoseLandmarks | null = null
        let ghostLabel = ''
        let ghostOk = false
        if (clash.rival === 'reference') {
          const targets =
            clash.mode === 'flow' ? poseTargets(pose.joints) : sampleCombo(combo, t, comboStart).targets
          rivalLms = skeletonFromTargets(targets)
          ghostLabel = clash.mode === 'flow' ? pose.name : sampleCombo(combo, t, comboStart).label
          ghostOk = true
        } else if (clash.rival === 'recorded') {
          const gf = ghostPlayer.frame(t)
          if (gf) {
            rivalLms = gf.landmarks
            ghostLabel = recorded?.name ?? 'Ghost'
            ghostOk = true
          }
        } else if (clash.rival === 'live' && peer) {
          peer.remote.tick(now)
          const rl = peer.remote.sample(now)
          if (rl) {
            rivalLms = rl
            ghostLabel = peer.connected ? 'Rival · live' : 'Waiting for rival…'
            ghostOk = peer.connected
          } else {
            ghostLabel = 'Waiting for rival…'
          }
        }

        // --- scoring ---
        let match: MatchResult | null = null
        let accuracy = 0
        if (detected && lms) {
          if (clash.mode === 'flow') {
            match = scoreFlow(angles, pose)
            accuracy = match.accuracy
            if (accuracy >= 70) {
              holdBank += dt
              if (Math.floor(holdBank / 2000) !== Math.floor((holdBank - dt) / 2000)) {
                coachVoice.say('Hold pose…', 8000)
              }
            }
            if (holdBank >= pose.holdMs) {
              pushEvent(`Held ${pose.name}!`)
              finish()
              return
            }
          } else {
            const s = sampleCombo(combo, t, comboStart)
            if (s.label !== currentLabel) {
              currentLabel = s.label
              labelSince = t
            }
            ghostLabel = clash.rival === 'reference' ? s.label : ghostLabel || s.label
            match = scoreAction(angles, s.targets)
            accuracy = match.accuracy
            for (const st of detector.update(lms, angles, now)) {
              strikeCount++
              recorder.strike(st.kind)
              score += Math.round(20 + st.quality * 60)
              coachVoice.praise(st.kind)
              const synced =
                currentLabel.toLowerCase().includes(KIND_IN_LABEL[st.kind]) && t - labelSince < 900
              if (synced) {
                score += 50
                pushEvent(`⚡ Synced ${st.kind}! +50`)
              } else {
                pushEvent(`${st.kind} · ${Math.round(st.quality * 100)}%`)
              }
            }
          }

          // Periodic sampling, defect logging, voice correction.
          if (now - lastSample > 500) {
            lastSample = now
            recorder.sample(accuracy)
            score += Math.round(accuracy / 20)
          }
          if (match && now - lastDefectLog > 4000 && match.defects.length > 0) {
            lastDefectLog = now
            const m: MatchResult = match
            for (const d of m.defects) recorder.defect(d, contextName())
            if (clash.mode === 'flow') {
              const cue = pose.joints.find((j) => j.joint === m.defects[0].joint)?.cue
              if (cue) coachVoice.correct(cue)
            } else if (accuracy < 55) {
              coachVoice.say('Match the ghost…', 7000)
            }
          }
        }

        const remoteAge =
          peer && peer.remote.ageMs !== Number.POSITIVE_INFINITY ? peer.remote.ageMs : 0
        recorder.syncSample(performance.now() - proc0 + remoteAge)

        // --- draw ---
        if (userCanvasRef.current) drawClashUser(userCanvasRef.current, lms, match, true)
        if (ghostCanvasRef.current && clash.rival !== 'none') {
          drawGhost(ghostCanvasRef.current, rivalLms, ghostLabel || contextName(), true)
        }

        // --- timer ---
        const elapsed = (t - t0) / 1000
        const timeLeft = Math.max(0, clash.durationSec - elapsed)
        if (timeLeft <= 0) {
          finish()
          return
        }

        if (now - lastHudPush > 200) {
          lastHudPush = now
          setHud({
            accuracy, detected, conf, timeLeft,
            holdPct: clash.mode === 'flow' ? Math.min(100, (holdBank / pose.holdMs) * 100) : 0,
            score, strikes: strikeCount, label: ghostLabel || contextName(),
            ghostOk, events: [...events],
          })
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }
    void boot()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      if (stream) for (const t of stream.getTracks()) t.stop()
      service.close()
      coachVoice.setEnabled(true)
    }
    // Boot once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePause = () => {
    const now = performance.now()
    if (!pausedRef.current) {
      ctlRef.current.pauseBegan = now
      pausedRef.current = true
      setPaused(true)
    } else {
      ctlRef.current.accum += now - ctlRef.current.pauseBegan
      ctlRef.current.resync = true
      pausedRef.current = false
      setPaused(false)
    }
  }

  const abandon = () => {
    finishedRef.current = true
    go('rival')
  }

  const accColor =
    hud.accuracy >= 80 ? 'text-emerald-400' : hud.accuracy >= 60 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center bg-base-950 px-4 py-6 font-sans animate-fadeIn select-none">
      {/* Dynamic Header HUD */}
      <div className="glass-surface flex w-full max-w-5xl items-center justify-between rounded-2xl px-5 py-3.5 shadow-glass">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">{clash.mode === 'flow' ? '🧘' : '🥊'}</span>
            <h2 className="text-sm font-bold tracking-tight text-white">
              {clash.mode === 'flow' ? getPose(clash.poseId).name : getCombo(clash.comboId).name}
            </h2>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
              vs. {clash.rival}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {clash.mode === 'flow' ? 'Joint alignment hold' : 'Velocity strike sync'}
          </p>
        </div>

        {/* Big Accuracy Metric */}
        <div className="text-center">
          <div className={`text-3xl font-extrabold tracking-[-0.03em] ${accColor}`}>
            {hud.accuracy}%
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-400">
            <span>⏱ {Math.ceil(hud.timeLeft)}s remaining</span>
            <span>·</span>
            <span>{hud.detected ? `${Math.round(hud.conf * 100)}% lock` : 'searching'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="apple-press glass-pill flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-slate-200 hover:text-white"
          >
            {paused ? '▶' : '⏸'}
          </button>
          <button
            onClick={abandon}
            className="apple-press glass-pill flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-slate-400 hover:text-rose-300"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Mode-Specific Metrics Capsule */}
      {clash.mode === 'flow' && (
        <div className="mt-3 w-full max-w-5xl">
          <div className="glass-surface rounded-xl p-3 shadow-glass-sm">
            <div className="flex justify-between text-xs font-medium text-slate-400 mb-1">
              <span>Pose Alignment Hold Gauge</span>
              <span className="font-mono text-cyan-300">{hud.holdPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-200 shadow-[0_0_12px_rgba(52,211,153,0.5)]"
                style={{ width: `${hud.holdPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {clash.mode === 'action' && (
        <div className="mt-3 w-full max-w-5xl">
          <div className="glass-surface flex items-center justify-between rounded-xl px-4 py-2 text-xs shadow-glass-sm">
            <div className="flex items-center gap-4 text-slate-300">
              <span>Score: <span className="font-bold text-cyan-400">{hud.score}</span></span>
              <span>Strikes: <span className="font-bold text-violet-400">{hud.strikes}</span></span>
            </div>
            <div className="text-slate-400">
              Ghost Target: <span className="font-semibold text-white">{hud.label}</span>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Dual Viewports */}
      <div className={`mt-4 grid w-full max-w-5xl gap-4 ${clash.rival === 'none' ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
        {/* User Viewport */}
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 shadow-glass-elevated border border-cyan-400/30 ring-1 ring-cyan-400/20">
          <div className="glass-pill absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-xs font-bold text-cyan-300">
            You (Camera Active)
          </div>
          <canvas ref={userCanvasRef} width={640} height={480} className="aspect-[4/3] w-full object-cover" />
        </div>

        {/* Rival Viewport */}
        {clash.rival !== 'none' && (
          <div className="relative overflow-hidden rounded-3xl bg-slate-950 shadow-glass-elevated border border-violet-400/30 ring-1 ring-violet-400/20">
            <div className="glass-pill absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-xs font-bold text-violet-300">
              Rival {hud.ghostOk ? '• Synced' : '(Connecting…)'}
            </div>
            <canvas ref={ghostCanvasRef} width={640} height={480} className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
      </div>

      {!clash.simUser && (
        <video ref={videoRef} playsInline muted className="hidden" style={{ transform: 'scaleX(-1)' }} />
      )}

      {/* Realtime Event Feed */}
      <div className="mt-4 flex w-full max-w-5xl flex-col items-start gap-1.5">
        {hud.events.map((e, i) => (
          <div
            key={`${i}-${e}`}
            className="glass-surface-subtle animate-sheetSlideUp rounded-xl px-3 py-1.5 text-xs text-slate-300 shadow-sm"
          >
            {e}
          </div>
        ))}
      </div>

      {/* Frosted Pause Dialog */}
      {paused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl animate-fadeIn">
          <div className="glass-surface w-full max-w-sm rounded-3xl p-6 text-center shadow-glass-elevated">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
              ⏸
            </div>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-white">Clash Session Paused</h3>
            <button
              onClick={togglePause}
              className="apple-press mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 py-3 text-xs font-bold text-base-950 shadow-md hover:brightness-105"
            >
              Resume Clash
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
