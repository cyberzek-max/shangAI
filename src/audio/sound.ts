/**
 * Minimal Web Audio synth for game feedback. No assets, no backend.
 * All sounds are short oscillator blips so there is no load cost.
 */
class SoundBank {
  enabled = true
  private ctx: AudioContext | null = null

  setEnabled(v: boolean): void {
    this.enabled = v
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null
    try {
      if (!this.ctx) {
        const AC = window.AudioContext
        this.ctx = new AC()
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  private tone(
    freq: number,
    durMs: number,
    type: OscillatorType = 'sine',
    gain = 0.08,
    slideTo?: number,
    delayMs = 0,
  ): void {
    const ctx = this.ensure()
    if (!ctx) return
    const t0 = ctx.currentTime + delayMs / 1000
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + durMs / 1000)
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + durMs / 1000 + 0.02)
  }

  click(): void {
    this.tone(520, 70, 'triangle', 0.05)
  }
  rep(): void {
    this.tone(440, 90, 'sine', 0.07, 660)
  }
  hit(): void {
    this.tone(220, 140, 'sawtooth', 0.06, 90)
    this.tone(880, 80, 'square', 0.03, undefined, 20)
  }
  enemyHit(): void {
    this.tone(160, 200, 'sawtooth', 0.07, 60)
  }
  special(): void {
    this.tone(300, 320, 'sawtooth', 0.08, 1200)
    this.tone(150, 420, 'sine', 0.07, 600, 60)
  }
  shield(): void {
    this.tone(520, 160, 'triangle', 0.06, 780)
  }
  dodge(): void {
    this.tone(700, 120, 'sine', 0.06, 240)
  }
  charge(): void {
    this.tone(180, 110, 'triangle', 0.05, 360)
  }
  victory(): void {
    this.tone(523, 140, 'triangle', 0.08)
    this.tone(659, 140, 'triangle', 0.08, undefined, 120)
    this.tone(784, 240, 'triangle', 0.09, undefined, 240)
  }
  gameover(): void {
    this.tone(330, 200, 'sawtooth', 0.07, 165)
    this.tone(220, 340, 'sawtooth', 0.07, 110, 160)
  }
}

export const sound = new SoundBank()
