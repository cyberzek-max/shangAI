import { LM, type ExerciseDef, type ExerciseId, type JointAngles, type MetricCtx } from '../types'
import { get } from '../pose/landmarks'

/**
 * Frontal knee lifts barely bend the 2D hip angle, so the lift is measured
 * from knee height relative to the hip instead. Returns a pseudo-angle on
 * the same scale: ~180 standing, ~85 with the knee at hip height.
 */
function kneeLiftValue(_angles: JointAngles, ctx: MetricCtx): number {
  const lms = ctx.landmarks
  if (!lms || ctx.torso <= 0) return NaN
  const hip = get(lms, LM.LEFT_HIP)
  const knee = get(lms, LM.LEFT_KNEE)
  if (!hip || !knee) return NaN
  const gap = (knee.y - hip.y) / ctx.torso
  const lift = Math.max(0, Math.min(1, 1 - gap / 0.7))
  return 180 - lift * 95
}

/**
 * Rule-based, explainable exercise definitions.
 * Each rule is a directional joint-angle threshold pair. No ML needed for the
 * prototype; the same MovementSignal interface can later be fed by a trained
 * classifier.
 */
export const EXERCISES: Record<ExerciseId, ExerciseDef> = {
  squat: {
    id: 'squat',
    name: 'Bodyweight Squat',
    shortName: 'Squat',
    icon: '🦵',
    description: 'Lower your hips by bending both knees, then stand tall.',
    instructions: [
      'Stand with feet shoulder-width apart, whole body in frame.',
      'Push your hips back and bend your knees until thighs are near parallel.',
      'Keep your chest up and knees tracking over your toes.',
      'Drive back up to a full stand to complete one repetition.',
    ],
    primaryRule: {
      joint: 'leftKnee',
      activeThreshold: 115,
      relaxedThreshold: 158,
      activeAbove: false,
      cues: { deepen: 'Sink lower', relax: 'Stand all the way up', good: 'Good depth' },
    },
    secondaryRule: {
      joint: 'rightKnee',
      activeThreshold: 115,
      relaxedThreshold: 158,
      activeAbove: false,
    },
    requiresBothSides: true,
    suggestedMode: 'bounty',
    defaultReps: 10,
    action: 'charge',
  },
  'arm-raise': {
    id: 'arm-raise',
    name: 'Overhead Arm Raise',
    shortName: 'Arm Raise',
    icon: '💪',
    description: 'Raise your arms from your sides to overhead.',
    instructions: [
      'Start with both arms relaxed at your sides.',
      'Sweep your arms forward and up until your hands are above your head.',
      'Keep elbows softly extended and shoulders relaxed.',
      'Lower back to your sides to complete one repetition.',
    ],
    primaryRule: {
      joint: 'leftShoulder',
      activeThreshold: 150,
      relaxedThreshold: 70,
      activeAbove: true,
      cues: { deepen: 'Raise higher', relax: 'Lower your arm', good: 'Nice height' },
    },
    secondaryRule: {
      joint: 'rightShoulder',
      activeThreshold: 150,
      relaxedThreshold: 70,
      activeAbove: true,
    },
    requiresBothSides: false,
    suggestedMode: 'endurance',
    defaultReps: 12,
    action: 'attack',
  },
  'lateral-raise': {
    id: 'lateral-raise',
    name: 'Lateral Arm Raise',
    shortName: 'Lateral Raise',
    icon: '🙆',
    description: 'Raise your arms out to the sides to shoulder height.',
    instructions: [
      'Start with arms down at your sides.',
      'Lift both arms sideways until they are level with your shoulders.',
      'Keep a slight bend in the elbows and wrists neutral.',
      'Return to your sides to complete one repetition.',
    ],
    primaryRule: {
      joint: 'leftShoulder',
      activeThreshold: 78,
      relaxedThreshold: 25,
      activeAbove: true,
      cues: { deepen: 'Lift to shoulder height', relax: 'Return arms down', good: 'Level arms' },
    },
    secondaryRule: {
      joint: 'rightShoulder',
      activeThreshold: 78,
      relaxedThreshold: 25,
      activeAbove: true,
    },
    requiresBothSides: true,
    suggestedMode: 'flow',
    defaultReps: 12,
    action: 'shield',
  },
  'knee-lift': {
    id: 'knee-lift',
    name: 'Standing Knee Lift',
    shortName: 'Knee Lift',
    icon: '🏃',
    description: 'Lift one knee toward your chest, then lower it.',
    instructions: [
      'Stand tall and hold onto something stable if needed.',
      'Lift your left knee up toward your chest.',
      'Keep your torso upright and avoid leaning back.',
      'Lower your foot to the floor to complete one repetition.',
    ],
    primaryRule: {
      joint: 'leftHip',
      activeThreshold: 115,
      relaxedThreshold: 160,
      activeAbove: false,
      getValue: kneeLiftValue,
      cues: { deepen: 'Lift the knee higher', relax: 'Foot back on the floor', good: 'Good lift' },
    },
    requiresBothSides: false,
    suggestedMode: 'bounty',
    defaultReps: 10,
    action: 'dodge',
  },
}

export const EXERCISE_LIST: ExerciseDef[] = [
  EXERCISES.squat,
  EXERCISES['arm-raise'],
  EXERCISES['lateral-raise'],
  EXERCISES['knee-lift'],
]
