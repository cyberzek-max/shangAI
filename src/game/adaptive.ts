import type { DifficultyId, Settings } from '../types'
import type { AdaptiveInput, AdaptiveProfile } from './types'

export interface DifficultyPreset {
  label: string
  enemyMaxHp: number
  attackIntervalMs: number
  enemyDamage: number
  repsRequired: number
  speed: number
}

export const DIFFICULTY_PRESETS: Record<Exclude<DifficultyId, 'adaptive'>, DifficultyPreset> = {
  gentle: {
    label: 'Gentle',
    enemyMaxHp: 70,
    attackIntervalMs: 3400,
    enemyDamage: 5,
    repsRequired: 6,
    speed: 0.9,
  },
  standard: {
    label: 'Standard',
    enemyMaxHp: 110,
    attackIntervalMs: 2700,
    enemyDamage: 8,
    repsRequired: 9,
    speed: 1.0,
  },
  intense: {
    label: 'Intense',
    enemyMaxHp: 160,
    attackIntervalMs: 2100,
    enemyDamage: 12,
    repsRequired: 13,
    speed: 1.15,
  },
}

export function basePreset(difficulty: DifficultyId): DifficultyPreset {
  if (difficulty === 'adaptive') return DIFFICULTY_PRESETS.standard
  return DIFFICULTY_PRESETS[difficulty]
}

const MAX_INTENSITY_LEVEL: Record<Settings['maxIntensity'], number> = {
  low: 1,
  medium: 2,
  high: 4,
}

export function profileForLevel(level: number, preset: DifficultyPreset): AdaptiveProfile {
  return {
    level,
    enemyHpMult: 1 + level * 0.12,
    attackIntervalMult: Math.max(0.7, 1 - level * 0.06),
    enemyDamageMult: 1 + level * 0.08,
    speedMult: 1 + level * 0.05,
    repsRequired: preset.repsRequired + level,
  }
}

/**
 * Transparent, rule-based adaptive difficulty.
 * Levels move up when the player is completing reps confidently and on time,
 * and down when they are struggling. Hard-capped by the player's chosen
 * intensity so exercise load is never increased beyond their limit.
 */
export class AdaptiveController {
  profile: AdaptiveProfile
  private maxLevel: number
  private preset: DifficultyPreset
  private lastChangeAt = 0

  constructor(difficulty: DifficultyId, maxIntensity: Settings['maxIntensity'], nowMs: number) {
    this.preset = basePreset(difficulty)
    this.maxLevel = difficulty === 'adaptive' ? MAX_INTENSITY_LEVEL[maxIntensity] : 0
    this.profile = profileForLevel(0, this.preset)
    this.lastChangeAt = nowMs
  }

  get adaptive(): boolean {
    return this.maxLevel > 0
  }

  update(input: AdaptiveInput, nowMs: number): void {
    if (this.maxLevel === 0) return
    // Only re-evaluate every 5 seconds to avoid oscillation.
    if (nowMs - this.lastChangeAt < 5000) return

    const performance =
      0.5 * clamp01(input.completionRate) +
      0.5 * clamp01(input.avgConfidence) -
      Math.min(0.3, input.missedReps * 0.02) -
      Math.min(0.2, Math.max(0, input.avgReactionMs - 1500) / 8000)

    let level = this.profile.level
    if (performance > 0.72 && level < this.maxLevel) level += 1
    else if (performance < 0.4 && level > 0) level -= 1
    else return

    this.profile = profileForLevel(level, this.preset)
    this.lastChangeAt = nowMs
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}
