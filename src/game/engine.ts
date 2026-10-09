import type {
  ActionMapping,
  DifficultyId,
  ExerciseId,
  GameAction,
  PoseAnalysisResult,
  Settings,
} from '../types'
import { DEFAULT_MAPPING } from './actions'
import { AdaptiveController, basePreset } from './adaptive'
import type { AdaptiveInput, Effect, EffectKind, GameEvent, GameState } from './types'

const MAX_HP = 100
const MAX_ENERGY = 100
const SPECIAL_COST = 70
const BASE_ATTACK = 8
const MAX_EVENTS = 6
const REP_INTERVAL_MS = 2600

export interface EngineConfig {
  difficulty: DifficultyId
  maxIntensity: Settings['maxIntensity']
  mapping?: ActionMapping
  enemyName?: string
  /** Training mode: the enemy never damages the player. */
  passive?: boolean
}

/**
 * Game rules and state. Feed it pose analysis results and drive time with tick().
 */
export class GameEngine {
  state: GameState
  mapping: ActionMapping
  adaptive: AdaptiveController

  private cooldownUntil: Record<GameAction, number> = {
    attack: 0,
    'attack-left': 0,
    'attack-right': 0,
    special: 0,
    shield: 0,
    dodge: 0,
    charge: 0,
  }
  private effectId = 1
  private eventId = 1
  private confidenceSum = 0
  private frames = 0
  private lastRepAt = 0
  private repIntervalSum = 0
  private repIntervalCount = 0
  private dodgePulseUntil = 0
  private specialPulseUntil = 0

  constructor(config: EngineConfig, nowMs: number) {
    const preset = basePreset(config.difficulty)
    this.mapping = config.mapping ?? DEFAULT_MAPPING
    this.adaptive = new AdaptiveController(config.difficulty, config.maxIntensity, nowMs)
    const prof = this.adaptive.profile
    const enemyMaxHp = Math.round(preset.enemyMaxHp * prof.enemyHpMult)
    this.state = {
      status: 'idle',
      player: {
        hp: MAX_HP,
        maxHp: MAX_HP,
        energy: 0,
        maxEnergy: MAX_ENERGY,
        shieldMs: 0,
        invulnMs: 0,
      },
      enemy: {
        name: config.enemyName ?? 'Null-Wraith',
        level: 1,
        hp: enemyMaxHp,
        maxHp: enemyMaxHp,
        attackTimer: preset.attackIntervalMs * prof.attackIntervalMult,
        attackInterval: preset.attackIntervalMs * prof.attackIntervalMult,
        damage: preset.enemyDamage * prof.enemyDamageMult,
        windup: 0,
      },
      score: 0,
      combo: 0,
      comboTimer: 0,
      peakCombo: 0,
      xp: 0,
      level: 1,
      timeMs: 0,
      reps: 0,
      validReps: 0,
      effects: [],
      events: [],
      difficulty: config.difficulty,
      adaptiveLevel: 0,
      lastAction: null,
      lastActionAt: 0,
      repExerciseCounts: {},
      passive: config.passive ?? false,
    }
  }

  start(nowMs: number): void {
    this.state.status = 'running'
    this.lastRepAt = nowMs
  }

  pause(): void {
    if (this.state.status === 'running') this.state.status = 'paused'
  }

  resume(): void {
    if (this.state.status === 'paused') this.state.status = 'running'
  }

  get elapsedMs(): number {
    return this.state.timeMs
  }

  /** Map a pose analysis result to game actions. */
  processPose(result: PoseAnalysisResult, nowMs: number): void {
    if (this.state.status !== 'running') return

    this.frames++
    this.confidenceSum += result.confidence

    // Reps -> exercise-mapped actions.
    for (const rep of result.repEvents) {
      const action = this.mapping.exerciseAction[rep.exercise]
      const triggered = this.applyAction(action, rep.quality, nowMs)
      if (triggered) {
        this.state.reps++
        this.state.validReps++
        this.state.repExerciseCounts[rep.exercise] =
          (this.state.repExerciseCounts[rep.exercise] ?? 0) + 1
        this.recordRepTiming(nowMs)
      }
    }

    // Pose hold -> special/both-arm action.
    if (result.holdActive) {
      this.applyAction(this.mapping.bothArmsUpAction, 1, nowMs)
    }

    // Single-arm gestures -> side abilities (skipped when both arms are up).
    if (!result.arms.bothUp && result.arms.leftUp && !result.arms.rightUp) {
      this.applyAction('attack-left', 1, nowMs)
    } else if (!result.arms.bothUp && result.arms.rightUp && !result.arms.leftUp) {
      this.applyAction('attack-right', 1, nowMs)
    }
  }

  private recordRepTiming(nowMs: number): void {
    if (this.lastRepAt > 0) {
      const gap = nowMs - this.lastRepAt
      if (gap < 8000) {
        this.repIntervalSum += gap
        this.repIntervalCount++
      }
    }
    this.lastRepAt = nowMs
  }

  /** Apply a mapped action, respecting cooldowns. Returns true if it fired. */
  applyAction(action: GameAction, quality: number, nowMs: number): boolean {
    if (this.state.status !== 'running') return false
    const cd = this.mapping.cooldowns[action] ?? 0
    if (nowMs < this.cooldownUntil[action]) return false
    if (action === 'special') {
      const energy = this.state.player.energy
      if (energy < SPECIAL_COST) {
        this.pushEvent('Overdrive needs more energy', 'info', nowMs)
        // Do not burn the long cooldown; let the player build energy.
        return false
      }
      this.state.player.energy -= SPECIAL_COST
      this.cooldownUntil[action] = nowMs + cd
    } else {
      this.cooldownUntil[action] = nowMs + cd
    }

    this.state.lastAction = action
    this.state.lastActionAt = nowMs

    switch (action) {
      case 'attack':
      case 'attack-left':
      case 'attack-right':
        this.dealDamage(BASE_ATTACK + quality * 4, nowMs, action === 'attack' ? 'Strike' : 'Blast')
        this.state.player.energy = Math.min(MAX_ENERGY, this.state.player.energy + 6)
        break
      case 'charge':
        this.state.player.energy = Math.min(MAX_ENERGY, this.state.player.energy + 16)
        this.state.score += 5
        this.addEffect('charge', 'player')
        break
      case 'shield':
        this.state.player.shieldMs = 1600
        this.state.player.energy = Math.min(MAX_ENERGY, this.state.player.energy + 8)
        this.state.score += 6
        this.addEffect('shield', 'player')
        break
      case 'dodge':
        this.state.player.invulnMs = 700
        this.dodgePulseUntil = nowMs + 400
        this.state.score += 8
        this.addEffect('dodge', 'player')
        break
      case 'special':
        this.dealDamage(34 + quality * 8, nowMs, 'Overdrive')
        this.specialPulseUntil = nowMs + 600
        this.addEffect('special', 'enemy')
        break
    }
    return true
  }

  private dealDamage(amount: number, nowMs: number, label: string): void {
    const comboMult = 1 + Math.min(this.state.combo, 20) * 0.03
    const dmg = Math.round(amount * comboMult)
    this.state.enemy.hp = Math.max(0, this.state.enemy.hp - dmg)
    this.state.combo += 1
    this.state.peakCombo = Math.max(this.state.peakCombo, this.state.combo)
    this.state.comboTimer = 2600
    this.state.score += dmg * 5 + this.state.combo * 2
    this.state.xp += dmg
    this.addEffect('enemy-hit', 'enemy')
    this.pushEvent(`${label} -${dmg} (x${this.state.combo})`, 'good', nowMs)
    if (this.state.enemy.hp <= 0 && this.state.status === 'running') {
      this.state.status = 'victory'
      this.pushEvent(`${this.state.enemy.name} defeated!`, 'good', nowMs)
    }
  }

  /** Advance timers, enemy AI, effects and adaptive difficulty. */
  tick(dtMs: number, nowMs: number): void {
    const dt = Math.min(dtMs, 100)
    if (this.state.status === 'running') {
      this.state.timeMs += dt

      // Combo decay.
      if (this.state.comboTimer > 0) {
        this.state.comboTimer -= dt
        if (this.state.comboTimer <= 0) this.state.combo = 0
      }

      // Player status timers.
      if (this.state.player.shieldMs > 0) this.state.player.shieldMs = Math.max(0, this.state.player.shieldMs - dt)
      if (this.state.player.invulnMs > 0) this.state.player.invulnMs = Math.max(0, this.state.player.invulnMs - dt)

      // Enemy attack.
      const enemy = this.state.enemy
      enemy.attackTimer -= dt
      enemy.windup = enemy.attackTimer < 450 ? 1 - Math.max(0, enemy.attackTimer) / 450 : 0
      if (enemy.attackTimer <= 0) {
        this.enemyAttack(nowMs)
        const prof = this.adaptive.profile
        enemy.attackInterval = basePreset(this.state.difficulty).attackIntervalMs * prof.attackIntervalMult
        enemy.attackTimer = enemy.attackInterval
        enemy.windup = 0
      }

      // Adaptive difficulty.
      this.adaptive.update(this.metrics(), nowMs)
      this.state.adaptiveLevel = this.adaptive.profile.level
      if (this.adaptive.adaptive) {
        const pres = basePreset(this.state.difficulty)
        const prof = this.adaptive.profile
        const targetHp = Math.round(pres.enemyMaxHp * prof.enemyHpMult)
        // Grow the enemy HP ceiling with adaptation (never shrink below current).
        if (targetHp > enemy.maxHp) {
          enemy.maxHp = targetHp
        }
        enemy.damage = pres.enemyDamage * prof.enemyDamageMult
      }
    }

    // Effects and events always decay for clean visuals.
    for (const e of this.state.effects) e.ttl -= dt
    this.state.effects = this.state.effects.filter((e) => e.ttl > 0)
    const now = nowMs
    this.state.events = this.state.events.filter((e) => now - e.at < 3200)
  }

  private enemyAttack(nowMs: number): void {
    const enemy = this.state.enemy
    if (this.state.passive) {
      this.pushEvent('Training dummy holds still…', 'info', nowMs)
      return
    }
    if (this.state.player.invulnMs > 0) {
      this.pushEvent('Evaded!', 'good', nowMs)
      return
    }
    let dmg = enemy.damage
    if (this.state.player.shieldMs > 0) {
      dmg *= 0.15
      this.pushEvent('Barrier absorbed the hit', 'info', nowMs)
    } else {
      dmg = Math.round(dmg)
    }
    this.state.player.hp = Math.max(0, this.state.player.hp - Math.round(dmg))
    this.addEffect('player-hit', 'player')
    if (this.state.player.shieldMs <= 0) {
      this.pushEvent(`${enemy.name} hits you -${Math.round(dmg)}`, 'bad', nowMs)
    }
    if (this.state.player.hp <= 0 && this.state.status === 'running') {
      this.state.status = 'gameover'
      this.pushEvent('You were overwhelmed', 'bad', nowMs)
    }
  }

  metrics(): AdaptiveInput {
    const expected = Math.max(1, this.state.timeMs / REP_INTERVAL_MS)
    const avgConfidence = this.frames > 0 ? this.confidenceSum / this.frames : 0
    const avgReactionMs =
      this.repIntervalCount > 0 ? this.repIntervalSum / this.repIntervalCount : 0
    return {
      completionRate: Math.min(1, this.state.validReps / expected),
      missedReps: Math.max(0, Math.round(expected - this.state.validReps)),
      avgConfidence,
      avgReactionMs,
    }
  }

  private addEffect(kind: EffectKind, at: Effect['at']): void {
    this.state.effects.push({
      id: this.effectId++,
      kind,
      ttl: kind === 'special' ? 600 : 380,
      maxTtl: kind === 'special' ? 600 : 380,
      at,
    })
    if (this.state.effects.length > 24) this.state.effects.shift()
  }

  private pushEvent(text: string, tone: GameEvent['tone'], nowMs: number): void {
    this.state.events.push({ id: this.eventId++, text, at: nowMs, tone })
    if (this.state.events.length > MAX_EVENTS) this.state.events.shift()
  }

  // --- Visual-only reads for the 3D layer -------------------------------
  get dodgePulse(): boolean {
    return performance.now() < this.dodgePulseUntil
  }

  get specialPulse(): boolean {
    return performance.now() < this.specialPulseUntil
  }

  exerciseCounts(): Partial<Record<ExerciseId, number>> {
    return this.state.repExerciseCounts
  }
}
