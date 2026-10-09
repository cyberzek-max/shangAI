import type { ActionMapping, GameAction } from '../types'

/**
 * Configurable movement -> game action mapping.
 * Cooldowns and minimum hold durations prevent accidental repeated actions.
 */
export const DEFAULT_MAPPING: ActionMapping = {
  exerciseAction: {
    squat: 'charge',
    'arm-raise': 'attack',
    'lateral-raise': 'shield',
    'knee-lift': 'dodge',
  },
  bothArmsUpAction: 'special',
  cooldowns: {
    attack: 700,
    'attack-left': 900,
    'attack-right': 900,
    special: 2500,
    shield: 1600,
    dodge: 1200,
    charge: 300,
  },
  minHoldMs: 700,
}

export const ACTION_LABELS: Record<GameAction, string> = {
  attack: 'Strike',
  'attack-left': 'Left Blast',
  'attack-right': 'Right Blast',
  special: 'Overdrive',
  shield: 'Barrier',
  dodge: 'Evade',
  charge: 'Charge',
}
