import { EXERCISES } from '../analysis/exercises'
import { useAppStore } from '../state/store'
import { useShallow } from 'zustand/react/shallow'

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Results() {
  const { lastStats, progress, go, setPractice } = useAppStore(
    useShallow((s) => ({
      lastStats: s.lastStats,
      progress: s.progress,
      go: s.go,
      setPractice: s.setPractice,
    })),
  )

  if (!lastStats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <button onClick={() => go('home')} className="text-cyan-400">
          ← Back to menu
        </button>
      </div>
    )
  }

  const prev = progress.history.slice(0, -1)
  const bestScore = prev.reduce((m, h) => Math.max(m, h.score), 0)
  const bestReps = prev.reduce((m, h) => Math.max(m, h.validReps), 0)

  const outcome =
    lastStats.outcome === 'victory'
      ? { icon: '🏆', title: 'Wraith Defeated!', tone: 'text-emerald-300' }
      : lastStats.outcome === 'gameover'
        ? { icon: '💀', title: 'Overwhelmed', tone: 'text-red-300' }
        : { icon: '🚪', title: 'Session Ended', tone: 'text-slate-200' }

  const rows: [string, string][] = [
    ['Duration', fmtDuration(lastStats.durationMs)],
    ['Repetitions', `${lastStats.validReps} valid / ${lastStats.reps} total`],
    ['Movement consistency', `${lastStats.avgConsistency}%`],
    ['Avg. tracking confidence', `${Math.round(lastStats.avgConfidence * 100)}%`],
    ['Score', lastStats.score.toLocaleString()],
    ['XP earned', `+${lastStats.xpEarned}`],
    ['Peak combo', `x${lastStats.peakCombo}`],
    ['Difficulty', lastStats.difficulty],
  ]

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12 animate-fadeIn">
      {/* Hero Outcome Header */}
      <div className="flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/[0.08] text-4xl shadow-glass border border-white/15">
          {outcome.icon}
        </div>
        <h1 className={`mt-4 text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl ${outcome.tone}`}>
          {outcome.title}
        </h1>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Session Summary · {lastStats.difficulty} difficulty
        </p>
      </div>

      {/* Metrics Bento Grid */}
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="glass-surface flex items-center justify-between rounded-2xl p-4 shadow-glass-sm"
          >
            <span className="text-xs font-medium text-slate-400">{k}</span>
            <span className="text-base font-bold tracking-tight text-white">{v}</span>
          </div>
        ))}
      </div>

      {/* Breakdown Cards */}
      <div className="mt-3 grid w-full gap-3 sm:grid-cols-2">
        <div className="glass-surface rounded-2xl p-4 shadow-glass-sm">
          <span className="text-xs font-medium text-slate-400">Exercises Practiced</span>
          <p className="mt-1 text-sm font-semibold text-slate-200">
            {lastStats.exerciseIds.map((id) => EXERCISES[id]?.shortName ?? id).join(' · ')}
          </p>
        </div>

        <div className="glass-surface rounded-2xl p-4 shadow-glass-sm">
          <span className="text-xs font-medium text-slate-400">Personal Best Benchmark</span>
          <p className="mt-1 text-xs font-medium text-slate-300">
            Score: <span className="font-bold text-cyan-400">{lastStats.score.toLocaleString()}</span> (best {bestScore.toLocaleString()}) · Reps: <span className="font-bold text-violet-400">{lastStats.validReps}</span> (best {bestReps})
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => {
            setPractice(false)
            go('game')
          }}
          className="apple-press rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 px-6 py-3.5 text-xs font-bold text-white shadow-[0_8px_24px_-4px_rgba(14,165,233,0.4)] hover:brightness-105"
        >
          ▶ Play Again
        </button>
        <button
          onClick={() => go('select')}
          className="apple-press glass-surface rounded-2xl px-5 py-3.5 text-xs font-semibold text-slate-200 hover:text-white"
        >
          Switch Exercise
        </button>
        <button
          onClick={() => go('home')}
          className="apple-press glass-surface rounded-2xl px-5 py-3.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          Home Menu
        </button>
      </div>

    </div>
  )
}
