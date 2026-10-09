import { useEffect, useRef, useState } from 'react'
import { REFERENCE_POSES } from '../clash/referencePoses'
import { GHOST_COMBOS } from '../clash/ghostCombos'
import {
  GhostRecorder,
  deleteGhost,
  loadGhosts,
  type StoredGhost,
} from '../clash/ghost'
import { PoseService } from '../pose/poseService'
import { drawSkeleton } from '../components/SkeletonOverlay'
import {
  RivalPeer,
  SignalingClient,
  getLivePeer,
  setLivePeer,
} from '../net/peer'
import { useAppStore, type ClashRival } from '../state/store'
import { useShallow } from 'zustand/react/shallow'

/* ------------------------- ghost recorder panel ------------------------- */

function RecorderPanel({ onSaved }: { onSaved: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recRef = useRef<GhostRecorder | null>(null)
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [count, setCount] = useState(0)
  const [name, setName] = useState('My combo')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let raf = 0
    let stream: MediaStream | null = null
    const service = new PoseService()
    const rec = new GhostRecorder()
    recRef.current = rec
    ;(async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
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
        setReady(true)
        const loop = () => {
          if (!alive) return
          const now = performance.now()
          const lms = service.detect(video, now)
          rec.push(lms, now)
          if (canvasRef.current) drawSkeleton(canvasRef.current, lms, true)
          setCount(rec.count)
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Camera unavailable')
      }
    })()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      if (stream) for (const t of stream.getTracks()) t.stop()
      service.close()
    }
  }, [])

  return (
    <div className="rounded-xl border border-violet-400/50 bg-base-800 p-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 h-full w-full" />
        {!ready && !error && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Starting camera…</p>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      <div className="mt-2 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-base-600 bg-base-900 px-2 py-1.5 text-sm text-white"
          placeholder="Ghost name"
        />
        <span className="font-mono text-xs text-slate-400">{count} fr</span>
        {!recording ? (
          <button
            disabled={!ready}
            onClick={() => {
              recRef.current?.start()
              setRecording(true)
            }}
            className="rounded-lg bg-red-500 px-3 py-1.5 font-display text-xs font-bold uppercase text-white disabled:opacity-40"
          >
            ● Rec
          </button>
        ) : (
          <button
            onClick={() => {
              const g = recRef.current?.stop(name || 'My ghost')
              setRecording(false)
              if (g) onSaved()
            }}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 font-display text-xs font-bold uppercase text-base-950"
          >
            ■ Save
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Perform ~5–20 s of movement. Saved ghosts stay on this device.</p>
    </div>
  )
}

/* ------------------------------ live panel ------------------------------ */

function LivePanel({
  peerRef,
  relayUrl,
  room,
  onStatus,
}: {
  peerRef: React.MutableRefObject<RivalPeer | null>
  relayUrl: string
  room: string
  onStatus: (s: string) => void
}) {
  const [tab, setTab] = useState<'host' | 'join'>('host')
  const [invite, setInvite] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const sigRef = useRef<SignalingClient | null>(null)

  const peer = () => {
    if (!peerRef.current) {
      const p = new RivalPeer()
      p.onState = (s) => onStatus(`Peer: ${s}`)
      peerRef.current = p
    }
    return peerRef.current
  }

  const useRelay = async (role: 'host' | 'guest') => {
    if (!relayUrl) {
      onStatus('Enter a relay URL first (or use manual codes).')
      return
    }
    setBusy(true)
    try {
      const sig = new SignalingClient()
      sigRef.current = sig
      const p = peer()
      if (role === 'host') {
        const code = await p.createInvite()
        sig.onSignal = (kind, payload) => {
          if (kind === 'answer') void p.acceptAnswer(payload).then(() => onStatus('Peer: open — rival linked'))
        }
        sig.onOpen = () => {
          sig.send(room, 'offer', code)
          onStatus('Invite sent via relay — waiting for guest…')
        }
        sig.connect(relayUrl, room)
      } else {
        sig.onSignal = (kind, payload) => {
          if (kind === 'offer') {
            void p.acceptInvite(payload).then((ans) => {
              sig.send(room, 'answer', ans)
              onStatus('Answer sent — connecting…')
            })
          }
        }
        sig.onOpen = () => onStatus('Relay open — waiting for host invite…')
        sig.connect(relayUrl, room)
      }
    } catch (err) {
      onStatus(err instanceof Error ? err.message : 'Relay failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-base-600 bg-base-800 p-3">
      <div className="flex gap-2">
        {(['host', 'join'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg border px-3 py-1.5 font-display text-xs font-bold uppercase ${
              tab === t ? 'border-cyan-400 text-cyan-300' : 'border-base-600 text-slate-400'
            }`}
          >
            {t === 'host' ? 'Host (invite)' : 'Join (guest)'}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-slate-500">WebRTC · server-free</span>
      </div>

      {tab === 'host' ? (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true)
                peer()
                  .createInvite()
                  .then((code) => {
                    setInvite(code)
                    onStatus('Invite ready — send it to your rival.')
                  })
                  .catch((e) => onStatus(e instanceof Error ? e.message : 'Failed'))
                  .finally(() => setBusy(false))
              }}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 font-display text-xs font-bold uppercase text-base-950 disabled:opacity-40"
            >
              1. Create invite
            </button>
            <button
              disabled={busy || !relayUrl}
              onClick={() => void useRelay('host')}
              className="rounded-lg border border-base-600 px-3 py-1.5 font-display text-xs font-bold uppercase text-slate-300 disabled:opacity-40"
            >
              Send via relay
            </button>
          </div>
          <textarea value={invite} readOnly rows={2} placeholder="Invite code appears here — copy it to your rival"
            className="w-full rounded-lg border border-base-600 bg-base-900 p-2 font-mono text-[11px] text-slate-200" />
          <div className="flex gap-2">
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="2. Paste rival's answer code"
              className="min-w-0 flex-1 rounded-lg border border-base-600 bg-base-900 px-2 py-1.5 font-mono text-[11px] text-white" />
            <button
              disabled={busy || !answer}
              onClick={() => {
                setBusy(true)
                peer()
                  .acceptAnswer(answer)
                  .then(() => onStatus('Connecting…'))
                  .catch((e) => onStatus(e instanceof Error ? e.message : 'Bad code'))
                  .finally(() => setBusy(false))
              }}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 font-display text-xs font-bold uppercase text-base-950 disabled:opacity-40"
            >
              Connect
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="Paste host invite code"
              className="min-w-0 flex-1 rounded-lg border border-base-600 bg-base-900 px-2 py-1.5 font-mono text-[11px] text-white" />
            <button
              disabled={busy || !invite}
              onClick={() => {
                setBusy(true)
                peer()
                  .acceptInvite(invite)
                  .then((ans) => {
                    setAnswer(ans)
                    onStatus('Answer ready — send it back to the host.')
                  })
                  .catch((e) => onStatus(e instanceof Error ? e.message : 'Bad code'))
                  .finally(() => setBusy(false))
              }}
              className="rounded-lg bg-cyan-500 px-3 py-1.5 font-display text-xs font-bold uppercase text-base-950 disabled:opacity-40"
            >
              Join
            </button>
            <button
              disabled={busy || !relayUrl}
              onClick={() => void useRelay('guest')}
              className="rounded-lg border border-base-600 px-3 py-1.5 font-display text-xs font-bold uppercase text-slate-300 disabled:opacity-40"
            >
              Listen via relay
            </button>
          </div>
          <textarea value={answer} readOnly rows={2} placeholder="Your answer code appears here"
            className="w-full rounded-lg border border-base-600 bg-base-900 p-2 font-mono text-[11px] text-slate-200" />
        </div>
      )}
    </div>
  )
}

/* --------------------------------- screen -------------------------------- */

export function RivalSelect() {
  const { go, clash, setClash } = useAppStore(
    useShallow((s) => ({ go: s.go, clash: s.clash, setClash: s.setClash })),
  )
  const [ghosts, setGhosts] = useState<StoredGhost[]>(() => loadGhosts())
  const [showRecorder, setShowRecorder] = useState(false)
  const [peerMsg, setPeerMsg] = useState('')
  const [peerState, setPeerState] = useState('')
  const peerRef = useRef<RivalPeer | null>(null)
  const committedRef = useRef(false)

  // Adopt an already-connected peer (e.g. returning from a session).
  useEffect(() => {
    const existing = getLivePeer()
    if (existing && existing.connected) {
      peerRef.current = existing
      setPeerState('open')
    }
    return () => {
      if (!committedRef.current) {
        peerRef.current?.close()
        if (getLivePeer() === peerRef.current) setLivePeer(null)
      }
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const p = peerRef.current
      if (p && p.state === 'open' && peerState !== 'open') setPeerState('open')
      else if (p && p.state !== 'open' && peerState === 'open') setPeerState(p.state)
    }, 500)
    return () => window.clearInterval(id)
  }, [peerState])

  const setRival = (rival: ClashRival) => setClash({ rival })

  const canStart =
    clash.rival !== 'live' || peerRef.current?.connected || peerState === 'open'

  const start = () => {
    if (clash.rival === 'live') {
      const p = peerRef.current
      if (!p || !p.connected) {
        setPeerMsg('Link the rival peer first (status must be open).')
        return
      }
      setLivePeer(p)
    } else {
      peerRef.current?.close()
      setLivePeer(null)
    }
    committedRef.current = true
    go('clash')
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-8 sm:px-6 sm:py-10 animate-fadeIn">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <button
          onClick={() => go('home')}
          className="apple-press glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <span>←</span> Back to Menu
        </button>
        <span className="text-xs font-medium text-slate-400">Pose Clash Arena</span>
      </div>

      <div className="mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl">
          Pose Clash Configuration
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Match joint angles against AI references, your recorded ghosts, or a live P2P rival.
        </p>
      </div>

      {/* Discipline Mode Segmented Switcher */}
      <div className="mt-6 mx-auto grid w-full max-w-lg grid-cols-2 gap-2.5">
        {(
          [
            { id: 'flow', icon: '🧘', name: 'Static Flow', desc: 'Yoga poses · Joint angle tolerance' },
            { id: 'action', icon: '🥊', name: 'Dynamic Action', desc: 'Boxing strikes · Ghost sync tempo' },
          ] as const
        ).map((m) => {
          const active = clash.mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => setClash({ mode: m.id })}
              className={`apple-press relative flex flex-col items-start rounded-2xl p-4 text-left transition-all ${
                active
                  ? 'glass-surface border-cyan-400/50 shadow-[0_8px_24px_rgba(56,217,230,0.2)] ring-1 ring-cyan-400/30'
                  : 'glass-surface-subtle hover:border-white/20'
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <span className="mt-2 text-sm font-bold text-white">{m.name}</span>
              <span className="text-[11px] text-slate-400 mt-0.5">{m.desc}</span>
            </button>
          )
        })}
      </div>

      {/* Reference Selection */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {clash.mode === 'flow' ? 'Target Pose Reference' : 'Ghost Strike Routine'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(clash.mode === 'flow' ? REFERENCE_POSES : GHOST_COMBOS).map((r) => {
            const active = clash.mode === 'flow' ? clash.poseId === r.id : clash.comboId === r.id
            return (
              <button
                key={r.id}
                onClick={() => (clash.mode === 'flow' ? setClash({ poseId: r.id }) : setClash({ comboId: r.id }))}
                title={r.description}
                className={`apple-press flex flex-col justify-between rounded-2xl p-3.5 text-left transition-all ${
                  active
                    ? 'glass-surface border-violet-400/60 shadow-[0_4px_20px_rgba(139,92,246,0.25)] ring-1 ring-violet-400/40'
                    : 'glass-surface-subtle hover:border-white/15'
                }`}
              >
                <span className="text-2xl">{r.icon}</span>
                <span className="mt-2 text-xs font-bold text-white">{r.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Rival Source Selection */}
      <div className="mt-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Rival Competitor
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { id: 'reference', icon: '👻', name: 'Ideal Ghost', desc: 'Pre-rendered timeline' },
              { id: 'recorded', icon: '📼', name: 'Personal Ghost', desc: `${ghosts.length} saved recordings` },
              { id: 'live', icon: '📡', name: 'Live Rival', desc: 'WebRTC P2P stream' },
              { id: 'none', icon: '🎯', name: 'Solo Training', desc: 'Reference checklist' },
            ] as { id: ClashRival; icon: string; name: string; desc: string }[]
          ).map((r) => {
            const active = clash.rival === r.id
            return (
              <button
                key={r.id}
                onClick={() => setRival(r.id)}
                className={`apple-press flex flex-col justify-between rounded-2xl p-3.5 text-left transition-all ${
                  active
                    ? 'glass-surface border-cyan-400/50 shadow-[0_4px_20px_rgba(56,217,230,0.2)] ring-1 ring-cyan-400/30'
                    : 'glass-surface-subtle hover:border-white/15'
                }`}
              >
                <span className="text-2xl">{r.icon}</span>
                <div className="mt-2">
                  <div className="text-xs font-bold text-white">{r.name}</div>
                  <div className="text-[10px] text-slate-400">{r.desc}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ghost Recordings Panel */}
      {clash.rival === 'recorded' && (
        <div className="mt-4 glass-surface rounded-2xl p-4 shadow-glass-sm space-y-2.5">
          {ghosts.length === 0 && !showRecorder && (
            <p className="text-xs text-slate-400">No personal ghost recordings saved on this device yet.</p>
          )}
          {ghosts.map((g) => (
            <div
              key={g.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors ${
                clash.ghostId === g.id
                  ? 'bg-violet-500/15 border border-violet-400/40 text-white'
                  : 'bg-white/[0.03] border border-white/[0.06] text-slate-300'
              }`}
            >
              <button onClick={() => setClash({ ghostId: g.id })} className="flex items-center gap-2 font-medium text-left">
                <span>📼</span> {g.name} <span className="font-mono text-[10px] text-slate-500">({(g.frames.length / 15).toFixed(0)}s)</span>
              </button>
              <button
                onClick={() => {
                  const next = deleteGhost(g.id)
                  setGhosts(next)
                  if (clash.ghostId === g.id) setClash({ ghostId: undefined })
                }}
                className="text-[11px] text-rose-400 hover:text-rose-300 px-2 py-0.5"
              >
                Delete
              </button>
            </div>
          ))}
          {!showRecorder ? (
            <button
              onClick={() => setShowRecorder(true)}
              className="apple-press inline-flex items-center gap-2 rounded-xl border border-dashed border-violet-400/50 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20"
            >
              + Record New Ghost Routine
            </button>
          ) : (
            <RecorderPanel
              onSaved={() => {
                setGhosts(loadGhosts())
                setShowRecorder(false)
              }}
            />
          )}
        </div>
      )}

      {/* Live Rival WebRTC Panel */}
      {clash.rival === 'live' && (
        <div className="mt-4 glass-surface rounded-2xl p-4 shadow-glass-sm space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={clash.relayUrl}
              onChange={(e) => setClash({ relayUrl: e.target.value })}
              placeholder="Signaling Relay URL (optional)"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <input
              value={clash.room}
              onChange={(e) => setClash({ room: e.target.value })}
              placeholder="Room code (e.g. dojo-1)"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
          </div>
          <LivePanel peerRef={peerRef} relayUrl={clash.relayUrl} room={clash.room} onStatus={setPeerMsg} />
          {(peerMsg || peerState) && (
            <div className="inline-flex items-center gap-2 rounded-lg bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-300">
              <span>{peerMsg}</span>
              {peerState === 'open' && <span className="font-bold">✓ Peer Connected</span>}
            </div>
          )}
        </div>
      )}

      {/* Session Controls Capsule */}
      <div className="mt-6 glass-surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 shadow-glass-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300">
            Duration:
            <select
              value={clash.durationSec}
              onChange={(e) => setClash({ durationSec: Number(e.target.value) })}
              className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-white"
            >
              {[30, 60, 90, 120].map((s) => (
                <option key={s} value={s}>
                  {s} seconds
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={clash.voice}
              onChange={(e) => setClash({ voice: e.target.checked })}
              className="rounded border-white/20 text-cyan-500 focus:ring-0"
            />
            Voice Coaching
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={clash.simUser}
              onChange={(e) => setClash({ simUser: e.target.checked })}
              className="rounded border-white/20 text-violet-500 focus:ring-0"
            />
            Simulated Input
          </label>
        </div>

        <button
          onClick={start}
          disabled={!canStart}
          className="apple-press rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:brightness-105 disabled:opacity-40"
        >
          Enter Clash Arena →
        </button>
      </div>

      {!canStart && (
        <p className="mt-2 text-center text-xs text-amber-300">
          ⚠️ Link your live peer before entering the session.
        </p>
      )}
    </div>
  )
}
