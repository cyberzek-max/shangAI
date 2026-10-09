import { EXERCISE_LIST } from '../analysis/exercises'
import { ACTION_LABELS } from '../game/actions'
import { DIFFICULTY_PRESETS } from '../game/adaptive'
import { useAppStore } from '../state/store'
import { useShallow } from 'zustand/react/shallow'
import type { ExerciseId } from '../types'

export function ExerciseSelection() {
  const { go, settings, updateSettings, practice } = useAppStore(
    useShallow((s) => ({
      go: s.go,
      settings: s.settings,
      updateSettings: s.updateSettings,
      practice: s.practice,
    })),
  )
  const preset =
    settings.difficulty === 'adaptive'
      ? DIFFICULTY_PRESETS.standard
      : DIFFICULTY_PRESETS[settings.difficulty]

  const choose = (id: ExerciseId) => {
    updateSettings({ selectedExercise: id })
    go('game')
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-8 sm:px-6 sm:py-10 animate-fadeIn">
      {/* Navigation Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <button
          onClick={() => go('setup')}
          className="apple-press glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
        >
          <span>←</span> Back
        </button>

        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <span className="glass-pill rounded-full px-2.5 py-1 text-[11px] font-medium text-cyan-300">
            {settings.difficulty} difficulty
          </span>
          {practice && (
            <span className="glass-pill rounded-full bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 border-emerald-400/30">
              Training Mode
            </span>
          )}
        </div>
      </div>

      {/* Screen Title */}
      <div className="mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-white sm:text-3xl">
          Choose Combat Movement
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
          Every movement powers a combat action in the arena. Select your target exercise.
        </p>
      </div>

      {/* Exercise Bento Cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {EXERCISE_LIST.map((ex) => {
          const isSelected = settings.selectedExercise === ex.id
          return (
            <button
              key={ex.id}
              onClick={() => choose(ex.id)}
              className={`apple-press group relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 text-left transition-all duration-200 ${
                isSelected
                  ? 'glass-surface border-cyan-400/50 shadow-[0_8px_32px_rgba(56,217,230,0.25)] ring-1 ring-cyan-400/40'
                  : 'glass-surface-subtle hover:border-white/20 hover:bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.08] text-2xl shadow-inner">
                      {ex.icon}
                    </span>
                    <div>
                      <h3 className="text-base font-bold tracking-[-0.01em] text-white">
                        {ex.name}
                      </h3>
                      <div className="mt-0.5 inline-flex items-center gap-1.5 rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300 border border-violet-500/25">
                        ⚡ Powers: {ACTION_LABELS[ex.action]}
                      </div>
                    </div>
                  </div>

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:bg-cyan-500 group-hover:text-base-950">
                    →
                  </span>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-slate-300/90">
                  {ex.description}
                </p>

                <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-2.5">
                  {ex.instructions.map((ins, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-[10px] text-cyan-400">{i + 1}.</span>
                      <span>{ins}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">Target: ~{preset.repsRequired} reps</span>
                <span className="capitalize text-slate-400">{ex.suggestedMode} focus</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
