import type { ReferencePose } from './types'

/**
 * Static/flow reference poses (Mode A). Targets are frontal-camera joint
 * angles in degrees; see JointTarget.tol for the green/red thresholds.
 * Values were chosen from standard yoga alignment, not from any one body.
 */
export const REFERENCE_POSES: ReferencePose[] = [
  {
    id: 'mountain',
    name: 'Mountain Pose',
    icon: '🧍',
    description: 'Stand tall, weight even, shoulders relaxed.',
    holdMs: 8000,
    joints: [
      { joint: 'leftKnee', target: 175, tol: 8, cue: 'Soften or straighten the left knee' },
      { joint: 'rightKnee', target: 175, tol: 8, cue: 'Soften or straighten the right knee' },
      { joint: 'leftShoulder', target: 15, tol: 12, cue: 'Let the left arm hang by your side' },
      { joint: 'rightShoulder', target: 15, tol: 12, cue: 'Let the right arm hang by your side' },
      { joint: 'trunkInclination', target: 3, tol: 7, cue: 'Straighten your back' },
    ],
  },
  {
    id: 'chair',
    name: 'Chair Pose',
    icon: '🪑',
    description: 'Sit back as if into a chair, arms sweeping overhead.',
    holdMs: 10000,
    joints: [
      { joint: 'leftKnee', target: 100, tol: 15, cue: 'Sink lower — thighs toward parallel' },
      { joint: 'rightKnee', target: 100, tol: 15, cue: 'Sink lower — thighs toward parallel' },
      { joint: 'leftShoulder', target: 160, tol: 18, cue: 'Raise the left arm higher' },
      { joint: 'rightShoulder', target: 160, tol: 18, cue: 'Raise the right arm higher' },
      { joint: 'trunkInclination', target: 25, tol: 12, cue: 'Keep the chest lifted, hinge at the hips' },
    ],
  },
  {
    id: 'warrior2',
    name: 'Warrior II',
    icon: '⚔️',
    description: 'Left knee bent over the ankle, arms reaching side to side.',
    holdMs: 10000,
    joints: [
      { joint: 'leftKnee', target: 95, tol: 15, cue: 'Bend the front knee toward 90 degrees' },
      { joint: 'rightKnee', target: 170, tol: 12, cue: 'Straighten the back leg' },
      { joint: 'leftShoulder', target: 85, tol: 15, cue: 'Lift the left arm to shoulder height' },
      { joint: 'rightShoulder', target: 85, tol: 15, cue: 'Lift the right arm to shoulder height' },
      { joint: 'trunkInclination', target: 5, tol: 8, cue: 'Straighten your back' },
    ],
  },
  {
    id: 'tree',
    name: 'Tree Pose',
    icon: '🌳',
    description: 'Stand on the right leg, arms overhead like branches.',
    holdMs: 12000,
    joints: [
      { joint: 'leftKnee', target: 50, tol: 20, cue: 'Draw the left heel higher up the leg' },
      { joint: 'rightKnee', target: 175, tol: 8, cue: 'Root down through the standing leg' },
      { joint: 'leftShoulder', target: 165, tol: 18, cue: 'Reach the left arm overhead' },
      { joint: 'rightShoulder', target: 165, tol: 18, cue: 'Reach the right arm overhead' },
      { joint: 'trunkInclination', target: 4, tol: 8, cue: 'Straighten your back' },
    ],
  },
]

export function getPose(id: string): ReferencePose {
  return REFERENCE_POSES.find((p) => p.id === id) ?? REFERENCE_POSES[0]
}
