import type { ClashMode, ClashReport, JointScore, StrikeKind } from './types'
import { defectLabel } from './scoring'

/**
 * Accumulates per-second accuracy, strike counts, defects and latency samples,
 * then emits the structured post-session payload (also embedded in the
 * copy-paste coach prompt for Claude).
 */
export class ClashRecorder {
  private accSum = 0
  private accN = 0
  peakAccuracy = 0
  private strikes: Partial<Record<StrikeKind, number>> = {}
  private defects = new Map<string, number>()
  /** Smallest observed pipeline+remote offset; lower is better synced. */
  private bestSync = Number.POSITIVE_INFINITY

  reset(): void {
    this.accSum = 0
    this.accN = 0
    this.peakAccuracy = 0
    this.strikes = {}
    this.defects = new Map()
    this.bestSync = Number.POSITIVE_INFINITY
  }

  sample(accuracy: number): void {
    this.accSum += accuracy
    this.accN++
    this.peakAccuracy = Math.max(this.peakAccuracy, accuracy)
  }

  strike(kind: StrikeKind): void {
    this.strikes[kind] = (this.strikes[kind] ?? 0) + 1
  }

  defect(j: JointScore, context: string): void {
    const label = defectLabel(j, context)
    this.defects.set(label, (this.defects.get(label) ?? 0) + 1)
  }

  /** Record one end-to-end offset sample (processing ms + remote frame age). */
  syncSample(ms: number): void {
    if (Number.isFinite(ms) && ms >= 0) this.bestSync = Math.min(this.bestSync, ms)
  }

  build(opts: {
    mode: ClashMode
    referenceName: string
    rival: string
    startedAt: number
    endedAt: number
  }): ClashReport {
    const defects = [...this.defects.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => (count > 1 ? `${label} (×${count})` : label))
    return {
      mode: opts.mode,
      referenceName: opts.referenceName,
      rival: opts.rival,
      startedAt: opts.startedAt,
      endedAt: opts.endedAt,
      durationMs: Math.max(0, opts.endedAt - opts.startedAt),
      avgAccuracy: this.accN ? Math.round(this.accSum / this.accN) : 0,
      peakAccuracy: Math.round(this.peakAccuracy),
      peakSyncMs:
        this.bestSync === Number.POSITIVE_INFINITY ? 0 : Math.round(this.bestSync),
      strikes: this.strikes,
      defects,
      samples: this.accN,
    }
  }
}

/**
 * Claude-ready coach prompt. Paste the whole block into Claude along with the
 * JSON to get a personalized summary + next-session plan.
 */
export function coachPrompt(report: ClashReport): string {
  return [
    'You are a supportive movement coach reviewing a pose-matching game session.',
    'Given the JSON below, write a short "Coach Summary" with: 1) biggest win,',
    '2) the ONE posture defect to fix next (with a concrete drill), 3) whether',
    'to raise, hold, or lower difficulty next session. Keep it under 150 words,',
    'plain language, no medical claims.',
    '',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
  ].join('\n')
}

export function downloadReport(report: ClashReport): void {
  try {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `zenclash-report-${new Date(report.startedAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    /* clipboard fallback is offered in the UI */
  }
}
