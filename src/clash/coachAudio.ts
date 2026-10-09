/**
 * Low-latency voice cues via the Web Speech API (no keys, no network).
 * Single-utterance queue with per-phrase cooldowns so feedback stays
 * helpful instead of nagging. (ElevenLabs could replace `speak()` later
 * behind the same interface if a key is ever configured.)
 */
export class CoachVoice {
  enabled = true
  private lastSpoken: Record<string, number> = {}
  private lastAny = 0

  setEnabled(v: boolean): void {
    this.enabled = v
    if (!v && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  /** Speak unless the same phrase fired recently or audio is off. */
  say(text: string, cooldownMs = 4000, priority = false): void {
    if (!this.enabled || !('speechSynthesis' in window)) return
    const now = performance.now()
    if (!priority) {
      if (now - (this.lastSpoken[text] ?? 0) < cooldownMs) return
      if (now - this.lastAny < 1200) return
    } else {
      window.speechSynthesis.cancel()
    }
    this.lastSpoken[text] = now
    this.lastAny = now
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1.05
      u.volume = 0.9
      window.speechSynthesis.speak(u)
    } catch {
      /* TTS unavailable; visual feedback still applies */
    }
  }

  praise(kind: string): void {
    const lines: Record<string, string[]> = {
      jab: ['Nice jab!', 'Snappy jab!'],
      cross: ['Great cross!', 'Clean cross!'],
      hook: ['Nasty hook!', 'Great hook!'],
      kick: ['Beautiful kick!', 'Great kick!'],
      hold: ['Hold pose…', 'Steady… breathe.'],
      good: ['Looking sharp!', 'Great form!'],
    }
    const arr = lines[kind] ?? lines.good
    this.say(arr[Math.floor(Math.random() * arr.length)], 5000)
  }

  correct(cue: string): void {
    this.say(cue, 6000)
  }
}

export const coachVoice = new CoachVoice()
