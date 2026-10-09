import { useState } from 'react'
import { coachPrompt, downloadReport } from '../clash/report'
import { useAppStore } from '../state/store'
import { useShallow } from 'zustand/react/shallow'

export function ClashReport() {
  const { clashReport, go } = useAppStore(
    useShallow((s) => ({ clashReport: s.clashReport, go: s.go })),
  )
  const [copied, setCopied] = useState(false)
  const [showJson, setShowJson] = useState(false)

  if (!clashReport) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <button onClick={() => go('home')} className="text-cyan-400">← Back to menu</button>
      </div>
    )
  }
  const r = clashReport
  const prompt = coachPrompt(r)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked; user can select manually */
    }
  }

  const strikeTotal = Object.values(r.strikes).reduce((a, b) => a + (b ?? 0), 0)
  const rows: [string, string][] = [
    ['Mode', r.mode === 'flow' ? '🧘 Static / Flow' : '🥊 Dynamic / Action'],
    ['Reference', r.referenceName],
    ['Rival', r.rival],
    ['Duration', `${Math.round(r.durationMs / 1000)}s`],
    ['Average accuracy', `${r.avgAccuracy}%`],
    ['Peak accuracy', `${r.peakAccuracy}%`],
    ['Peak sync speed', `${r.peakSyncMs} ms`],
    ['Strikes landed', `${strikeTotal}`],
  ]

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center px-4 py-8 sm:px-6 sm:py-12 animate-fadeIn">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-white/[0.08] text-3xl shadow-glass border border-white/15">
          📊
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          Pose Clash Analytics
        </h1>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Movement precision & joint angle sync report
        </p>
      </div>

      {/* Metrics Bento Grid */}
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="glass-surface flex items-center justify-between rounded-2xl p-4 shadow-glass-sm">
            <span className="text-xs font-medium text-slate-400">{k}</span>
            <span className="text-base font-bold tracking-tight text-white">{v}</span>
          </div>
        ))}
      </div>

      {/* Posture Defects */}
      <div className="mt-4 w-full glass-surface rounded-2xl p-4 shadow-glass-sm">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Form & Alignment Analysis
        </h3>
        {r.defects.length === 0 ? (
          <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-emerald-300">
            <span>✨</span> Perfect alignment — zero repeated defects detected.
          </div>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {r.defects.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-xs font-medium text-rose-300">
                <span>⚠️</span> {d}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI Coach Summary Card */}
      <div className="mt-4 w-full glass-surface rounded-2xl p-5 shadow-glass-sm border-violet-500/30">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-violet-200">
              AI Physical Therapy Debrief
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Copy formatted telemetry for Claude / ChatGPT clinical coach breakdown.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={copy}
            className="apple-press rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-500"
          >
            {copied ? '✓ Copied to Clipboard' : '📋 Copy Coach Prompt'}
          </button>
          <button
            onClick={() => downloadReport(r)}
            className="apple-press glass-pill rounded-xl px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white"
          >
            Download JSON
          </button>
          <button
            onClick={() => setShowJson(!showJson)}
            className="apple-press glass-pill rounded-xl px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            {showJson ? 'Hide Raw Data' : 'Inspect JSON'}
          </button>
        </div>

        {showJson && (
          <pre className="mt-3 max-h-60 overflow-auto rounded-xl bg-black/50 p-3 font-mono text-[11px] text-slate-300">
            {JSON.stringify(r, null, 2)}
          </pre>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={() => go('rival')}
          className="apple-press rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:brightness-105"
        >
          ⚔️ Play Rematch
        </button>
        <button
          onClick={() => go('home')}
          className="apple-press glass-surface rounded-2xl px-5 py-3 text-xs font-semibold text-slate-300 hover:text-white"
        >
          Home Menu
        </button>
      </div>

      {r.simulated && (
        <p className="mt-4 text-[11px] text-violet-300/80 font-medium">
          ⚙ Simulated session · Synthetic motion data.
        </p>
      )}
    </div>
  )
}
