import type { GhostCombo } from './types'

/**
 * Action-mode ghost timelines (Mode B). The ghost loops through keyframes and
 * the user mirrors them; scoring compares sparse joint targets with cosine /
 * Euclidean similarity each frame.
 *
 * Straight punches read weakly in frontal 2D, so jab/cross keyframes pair an
 * elbow extension with a shoulder shift, while hooks and kicks use big
 * lateral/upward joint excursions the camera sees clearly.
 */
export const GHOST_COMBOS: GhostCombo[] = [
  {
    id: 'jab-cross-hook',
    name: 'Jab · Cross · Hook',
    icon: '🥊',
    description: 'Mirror the ghost: snap the jab, drive the cross, rip the hook.',
    durationMs: 3200,
    keyframes: [
      { at: 0, label: 'Guard', targets: { leftElbow: 95, rightElbow: 95, leftShoulder: 45, rightShoulder: 45 } },
      { at: 400, label: 'Jab!', targets: { leftElbow: 155, leftShoulder: 62 } },
      { at: 800, label: 'Guard', targets: { leftElbow: 95, leftShoulder: 45 } },
      { at: 1200, label: 'Cross!', targets: { rightElbow: 155, rightShoulder: 62 } },
      { at: 1600, label: 'Guard', targets: { rightElbow: 95, rightShoulder: 45 } },
      { at: 2000, label: 'Hook!', targets: { leftElbow: 110, leftShoulder: 100 } },
      { at: 2500, label: 'Guard', targets: { leftElbow: 95, leftShoulder: 45 } },
    ],
  },
  {
    id: 'kick-flow',
    name: 'Roundhouse Flow',
    icon: '🦵',
    description: 'Chamber the left knee, extend through the kick, rechamber.',
    durationMs: 3000,
    keyframes: [
      { at: 0, label: 'Stance', targets: { leftKnee: 175, rightKnee: 175, trunkInclination: 5 } },
      { at: 600, label: 'Chamber', targets: { leftKnee: 90 } },
      { at: 1000, label: 'Kick!', targets: { leftKnee: 150 } },
      { at: 1500, label: 'Chamber', targets: { leftKnee: 90 } },
      { at: 2000, label: 'Stance', targets: { leftKnee: 175 } },
    ],
  },
]

export function getCombo(id: string): GhostCombo {
  return GHOST_COMBOS.find((c) => c.id === id) ?? GHOST_COMBOS[0]
}
