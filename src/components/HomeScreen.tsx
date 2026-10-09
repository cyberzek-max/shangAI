import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ACHIEVEMENT_DEFS, xpToNext } from '../state/storage'
import { useAppStore } from '../state/store'
import { DIFFICULTY_PRESETS } from '../game/adaptive'
import type { DifficultyId } from '../types'

function GlassPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="glass-surface rounded-3xl p-5 sm:p-6 shadow-glass animate-sheetSlideUp">
      <div className="flex items-baseline justify-between border-b border-white/[0.06] pb-3 mb-4">
        <h3 className="font-sans text-sm font-semibold tracking-[-0.01em] text-slate-100">
          {title}
        </h3>
        {subtitle && (
          <span className="font-mono text-xs text-slate-400">
            {subtitle}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

export function HomeScreen() {
  const { go, settings, updateSettings, progress, setSimulated, setPractice } = useAppStore(
    useShallow((s) => ({
      go: s.go,
      settings: s.settings,
      updateSettings: s.updateSettings,
      progress: s.progress,
      setSimulated: s.setSimulated,
      setPractice: s.setPractice,
    })),
  )
  const [tab, setTab] = useState<'none' | 'progress' | 'settings'>('none')

  const safeLevel = Math.max(1, progress.level || 1)
  const safeXp = Math.max(0, progress.xp || 0)
  const xpNeed = xpToNext(safeLevel)
  const prevTotal = Array.from({ length: Math.max(0, safeLevel - 1) }, (_, i) => xpToNext(i + 1)).reduce(
    (a, b) => a + b,
    0,
  )
  const intoLevel = Math.max(0, safeXp - prevTotal)
  const pct = Math.min(100, Math.round((intoLevel / Math.max(1, xpNeed)) * 100))

  const startReal = (practice: boolean) => {
    setPractice(practice)
    setSimulated(false)
    go('setup')
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center">
        <div className="group relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-600 shadow-[0_12px_32px_-4px_rgba(56,217,230,0.4),inset_0_2px_0_0_rgba(255,255,255,0.35)] transition-transform duration-300 hover:scale-105">
          <span className="text-3xl select-none">⚡</span>
          <div className="absolute inset-0 rounded-[26px] ring-1 ring-inset ring-white/20" />
        </div>

        <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
          ATHLETE<span className="bg-gradient-to-r from-cyan-400 to-sky-400 bg-clip-text text-transparent">MIND</span>
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/90">
          Bio-Bounty Hunter · AI Rehab Combat
        </p>

        <p className="mt-3 max-w-lg text-center text-sm leading-relaxed text-slate-300/90">
          Turn physical recovery into play. Your body is the controller — squat to charge energy,
          strike with velocity, and align your posture to overcome bosses.
        </p>
      </div>

      {/* Main Action Grid */}
      <div className="mt-8 grid w-full max-w-xl gap-3.5">
        {/* Primary Start Game */}
        <button
          onClick={() => startReal(false)}
          className="apple-press group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 p-5 text-left shadow-[0_10px_28px_-6px_rgba(14,165,233,0.45),inset_0_1px_0_0_rgba(255,255,255,0.35)] hover:brightness-105"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 items-center rounded-full bg-black/20 px-2.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Webcam Active
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
              Start Bounty Campaign
            </h2>
            <p className="mt-0.5 text-xs text-white/80">
              Full rehab battle with pose calibration & adaptive difficulty
            </p>
          </div>
          <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-200 group-hover:translate-x-0.5">
            <span className="text-lg">▶</span>
          </div>
          <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
        </button>

        {/* Secondary Dual Column */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => startReal(true)}
            className="apple-press glass-surface group flex flex-col justify-between rounded-2xl p-4 text-left hover:border-cyan-400/40"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
                🎯
              </span>
              <span className="text-xs text-slate-400 group-hover:text-cyan-400 transition-colors">Launch →</span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-100">Exercise Training</h3>
              <p className="mt-0.5 text-xs text-slate-400">Rep practice without enemy attacks</p>
            </div>
          </button>

          <button
            onClick={() => {
              setPractice(false)
              setSimulated(true)
              go('select')
            }}
            className="apple-press glass-surface group flex flex-col justify-between rounded-2xl p-4 text-left hover:border-violet-400/40"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 text-violet-400">
                🖥
              </span>
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
                No Camera
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm font-semibold text-slate-100">Demo (Simulated)</h3>
              <p className="mt-0.5 text-xs text-slate-400">Test combat with synthetic landmarks</p>
            </div>
          </button>
        </div>

        {/* Pose Clash Banner */}
        <button
          onClick={() => go('rival')}
          className="apple-press glass-surface group relative flex items-center justify-between overflow-hidden rounded-2xl border-violet-500/25 p-4 text-left hover:border-violet-400/50"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 text-xl ring-1 ring-violet-500/30">
              ⚔️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Pose Clash</h3>
                <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 ring-1 ring-inset ring-violet-400/30">
                  Yoga & Boxing
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Match joint angles side-by-side with Ghost & WebRTC rivals
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-violet-300 group-hover:translate-x-0.5 transition-transform">
            Open →
          </span>
        </button>

        {/* Level Capsule Card */}
        <div className="glass-surface flex items-center gap-4 rounded-2xl px-5 py-3.5 shadow-glass-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Level</span>
            <span className="text-base font-extrabold text-white">LV {progress.level}</span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-medium mb-1">
              <span>Next Level</span>
              <span className="font-mono text-slate-300">{intoLevel} / {xpNeed} XP</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 shadow-[0_0_12px_rgba(56,217,230,0.5)] transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Apple Segmented Control for Progress / Settings */}
        <div className="glass-pill flex rounded-2xl p-1 shadow-glass-sm">
          <button
            onClick={() => setTab(tab === 'progress' ? 'none' : 'progress')}
            className={`apple-press flex-1 rounded-xl py-2.5 text-xs font-semibold tracking-[-0.01em] transition-all duration-200 ${
              tab === 'progress'
                ? 'bg-white/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🏆 Achievements & History
          </button>
          <button
            onClick={() => setTab(tab === 'settings' ? 'none' : 'settings')}
            className={`apple-press flex-1 rounded-xl py-2.5 text-xs font-semibold tracking-[-0.01em] transition-all duration-200 ${
              tab === 'settings'
                ? 'bg-white/15 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙ Preferences
          </button>
        </div>

        {/* Progress Panel */}
        {tab === 'progress' && (
          <GlassPanel
            title="Session Achievements"
            subtitle={`${progress.totalSessions} sessions · ${progress.totalReps} total reps`}
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ACHIEVEMENT_DEFS.map((a) => {
                const got = progress.achievements.includes(a.id)
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs transition-colors ${
                      got
                        ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-400/25 shadow-[inset_0_1px_0_rgba(56,217,230,0.2)]'
                        : 'bg-white/[0.02] text-slate-500 border border-white/[0.04]'
                    }`}
                  >
                    <span className="text-base">{got ? '🏅' : '🔒'}</span>
                    <div>
                      <div className="font-semibold text-slate-100">{a.name}</div>
                      <div className="text-[10px] text-slate-400">{got ? 'Unlocked' : 'Locked'}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {progress.history.length > 0 && (
              <div className="mt-5 border-t border-white/[0.06] pt-4">
                <div className="text-xs font-medium text-slate-400 mb-2">Recent Sessions</div>
                <div className="space-y-1.5">
                  {progress.history.slice(-4).reverse().map((h, i) => (
                    <div
                      key={i}
                      className="glass-surface-subtle flex items-center justify-between rounded-xl px-3 py-2 text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <span>{h.outcome === 'victory' ? '🏆' : h.outcome === 'gameover' ? '💀' : '🚪'}</span>
                        <span>{h.reps} reps</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">{Math.round(h.durationMs / 1000)}s</span>
                      </div>
                      <span className="font-mono font-semibold text-cyan-400">{h.score.toLocaleString()} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassPanel>
        )}

        {/* Settings Panel */}
        {tab === 'settings' && (
          <GlassPanel title="Gameplay & Audio Settings">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Difficulty Mode
                </label>
                <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-black/30 p-1">
                  {(['gentle', 'standard', 'intense', 'adaptive'] as DifficultyId[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => updateSettings({ difficulty: d })}
                      className={`apple-press rounded-lg py-2 text-xs font-semibold capitalize transition-all ${
                        settings.difficulty === d
                          ? 'bg-cyan-500 text-base-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {d === 'adaptive' ? 'Adaptive' : DIFFICULTY_PRESETS[d].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Intensity Ceiling (Adaptive Cap)
                </label>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-black/30 p-1">
                  {(['low', 'medium', 'high'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => updateSettings({ maxIntensity: m })}
                      className={`apple-press rounded-lg py-2 text-xs font-semibold uppercase transition-all ${
                        settings.maxIntensity === m
                          ? 'bg-violet-500 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <span className="text-xs font-medium text-slate-200">Synthesized Sound Effects</span>
                <button
                  onClick={() => updateSettings({ sound: !settings.sound })}
                  className={`apple-press relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.sound ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.sound ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </GlassPanel>
        )}
      </div>

      {/* Medical Disclaimer Footer */}
      <footer className="mt-12 max-w-md text-center">
        <p className="text-[11px] leading-relaxed text-slate-400/80">
          Fitness & play — not medical diagnosis. AthleteMind does not provide medical-grade tracking.
          Consult a physician or physical therapist for guided injury rehabilitation.
        </p>
      </footer>
    </div>
  )
}

