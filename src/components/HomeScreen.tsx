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
  const { go, settings, updateSettings, progress, setPractice } = useAppStore(
    useShallow((s) => ({
      go: s.go,
      settings: s.settings,
      updateSettings: s.updateSettings,
      progress: s.progress,
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
    go('setup')
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12">
      {/* Brand Header */}
      <div className="flex w-full items-center gap-5 border-b border-indigo-300/15 pb-7 sm:gap-7 sm:pb-9">
        <div className="group relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl border border-sky-200/40 bg-gradient-to-br from-blue-400 via-indigo-500 to-violet-700 shadow-[0_0_38px_rgba(76,110,255,0.4),inset_0_1px_0_rgba(255,255,255,0.45)] transition-transform duration-300 hover:scale-105 sm:h-24 sm:w-24 sm:rounded-[28px]">
          <span className="select-none text-3xl drop-shadow-[0_0_12px_rgba(255,255,255,0.75)] sm:text-4xl">⚡</span>
          <div className="absolute inset-1 rounded-[14px] border border-white/20 sm:rounded-[23px]" />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="cyber-kicker mb-1">Camera-powered movement game</p>
          <h1 className="text-4xl font-black leading-none tracking-[-0.06em] text-white sm:text-6xl">
            SHANG<span className="bg-gradient-to-r from-sky-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">AI</span>
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            Your body is the controller. Move, adapt, and challenge the arena with real-time pose tracking.
          </p>
        </div>
      </div>

      {/* Main Action Grid */}
      <div className="mt-7 grid w-full max-w-3xl gap-4 sm:mt-9">
        {/* Primary Start Game */}
        <button
          onClick={() => startReal(false)}
          className="apple-press cyber-focus group relative flex min-h-36 items-center justify-between overflow-hidden rounded-[1.4rem] border border-sky-200/35 bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 p-5 text-left shadow-[0_14px_42px_-12px_rgba(65,85,255,0.8),inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 sm:p-7"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 items-center rounded-full bg-black/20 px-2.5 text-[11px] font-bold uppercase tracking-wider text-white">
                <span className="mr-1.5 h-1.5 rounded-full bg-amber-300" /> Camera required
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">
              Start Campaign
            </h2>
            <p className="mt-0.5 text-xs text-white/80">
              Enter the arena · pose calibration · adaptive difficulty
            </p>
          </div>
          <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur-md transition-transform duration-200 group-hover:translate-x-0.5">
            <span className="text-lg">▶</span>
          </div>
          <div className="absolute inset-0 bg-white/0 transition-colors group-hover:bg-white/5" />
        </button>

        {/* Secondary Dual Column */}
        <div className="grid gap-3">
          <button
            onClick={() => startReal(true)}
            className="apple-press cyber-focus glass-surface group flex min-h-24 items-center justify-between rounded-2xl p-4 text-left hover:border-sky-300/60 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">
                🎯
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Exercise Training</h3>
                <p className="mt-0.5 text-xs text-slate-400">Rep practice without enemy attacks</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 transition-colors group-hover:text-cyan-300">Launch →</span>
          </button>
        </div>

        {/* Live Multiplayer P2P Match Card */}
        <button
          onClick={() => {
            useAppStore.getState().setClash({ rival: 'live' })
            go('rival')
          }}
          className="apple-press cyber-focus group relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-violet-300/25 bg-gradient-to-r from-blue-950/75 via-indigo-950/60 to-violet-950/75 p-4 text-left shadow-[0_0_32px_rgba(85,75,255,0.14)] transition-all hover:border-violet-300/55 hover:shadow-[0_0_38px_rgba(85,75,255,0.24)] sm:p-5"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 via-sky-500/20 to-violet-600/20 text-2xl ring-1 ring-cyan-400/30">
              ⚔️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Live Multiplayer Arena</h3>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 ring-1 ring-inset ring-cyan-400/40">
                  1-Click Match
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-300">
                Fight a real friend live over WebRTC · Copy 1-Click invite link
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 group-hover:bg-cyan-500/20 transition-all">
            <span>Enter Arena</span>
            <span className="group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
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
          ShangAI is for general movement practice and entertainment, not medical advice,
          diagnosis, or treatment. Choose movements that feel safe for you.
        </p>
      </footer>
    </div>
  )
}

