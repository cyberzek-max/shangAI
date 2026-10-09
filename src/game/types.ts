import type { DifficultyId, ExerciseId, GameAction } from '../types'

export type GameStatus = 'idle' | 'running' | 'paused' | 'victory' | 'gameover'

export type EffectKind =
  | 'player-hit'
  | 'enemy-hit'
  | 'special'
  | 'shield'
  | 'dodge'
  | 'charge'

export interface Effect {
  id: number
  kind: EffectKind
  ttl: number
  maxTtl: number
  /** World position hint for the 3D layer. */
  at: 'player' | 'enemy'
}

export interface GameEvent {
  id: number
  text: string
  at: number
  tone: 'good' | 'bad' | 'info'
}

export interface EnemyState {
  name: string
  level: number
  hp: number
  maxHp: number
  attackTimer: number
  attackInterval: number
  damage: number
  /** Visual: windup timer for the attack animation. */
  windup: number
}

export interface PlayerState {
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  shieldMs: number
  invulnMs: number
}

export interface ActionRecord {
  count: number
  lastAt: number
}

export interface GameState {
  status: GameStatus
  player: PlayerState
  enemy: EnemyState
  score: number
  combo: number
  comboTimer: number
  peakCombo: number
  xp: number
  level: number
  timeMs: number
  reps: number
  validReps: number
  effects: Effect[]
  events: GameEvent[]
  difficulty: DifficultyId
  adaptiveLevel: number
  lastAction: GameAction | null
  lastActionAt: number
  /** Which exercise each recent scoring rep came from, for the results screen. */
  repExerciseCounts: Partial<Record<ExerciseId, number>>
  passive: boolean
}

export interface AdaptiveProfile {
  level: number
  enemyHpMult: number
  attackIntervalMult: number
  enemyDamageMult: number
  speedMult: number
  repsRequired: number
}

export interface AdaptiveInput {
  completionRate: number
  missedReps: number
  avgConfidence: number
  avgReactionMs: number
}
