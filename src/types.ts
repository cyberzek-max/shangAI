// Shared types for AthleteMind.
// Pose landmarks follow the MediaPipe Pose (BlazePose) 33-point topology.
// Coordinates are normalized to [0,1] (x right, y down) with a relative z.

export interface Landmark {
  x: number
  y: number
  z: number
  visibility?: number
}

export type PoseLandmarks = Landmark[]

/** MediaPipe BlazePose landmark indices we use. */
export const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const

export interface JointAngles {
  leftElbow: number
  rightElbow: number
  leftShoulder: number
  rightShoulder: number
  leftHip: number
  rightHip: number
  leftKnee: number
  rightKnee: number
  leftAnkle: number
  rightAnkle: number
  trunkInclination: number
}

export type ExerciseId = 'squat' | 'arm-raise' | 'lateral-raise' | 'knee-lift'

export type MovementPhase = 'neutral' | 'down' | 'up' | 'hold'

export type DifficultyId = 'gentle' | 'standard' | 'intense' | 'adaptive'

export interface AngleRule {
  joint: keyof JointAngles
  /** Value at/through which the movement is "active" (rep underway). */
  activeThreshold: number
  /** Value at which the movement has returned to "relaxed" (rep completes). */
  relaxedThreshold: number
  /** true when active means the angle is ABOVE the threshold (arm raise). */
  activeAbove: boolean
  /** Optional natural-language cues keyed by depth band. */
  cues?: { deepen: string; relax: string; good: string }
  /**
   * Optional custom value source. Used when a joint angle alone is not a
   * reliable cue (e.g. frontal knee lifts barely bend the 2D hip angle, so
   * knee height relative to the hip is used instead). Returns a pseudo-angle
   * on the same active/relaxed scale, or NaN when unavailable.
   */
  getValue?: (angles: JointAngles, ctx: MetricCtx) => number
}

export interface MetricCtx {
  landmarks: PoseLandmarks | null
  /** Shoulder-to-hip distance in normalized units (body-size reference). */
  torso: number
}

export interface ExerciseDef {
  id: ExerciseId
  name: string
  shortName: string
  icon: string
  description: string
  instructions: string[]
  primaryRule: AngleRule
  secondaryRule?: AngleRule
  requiresBothSides: boolean
  suggestedMode: GameModeId
  defaultReps: number
  /** Movement -> game action mapping used by the arena. */
  action: GameAction
}

export type GameModeId = 'bounty' | 'endurance' | 'flow'

export type GameAction =
  | 'attack'
  | 'attack-left'
  | 'attack-right'
  | 'special'
  | 'shield'
  | 'dodge'
  | 'charge'

export interface ActionMapping {
  /** Rep completion of the mapped exercise triggers this action. */
  exerciseAction: Record<ExerciseId, GameAction>
  /** Holding both arms up charges the special meter. */
  bothArmsUpAction: GameAction
  /** Minimum ms between two triggers of the same action. */
  cooldowns: Record<GameAction, number>
  /** Minimum ms a movement must be held before it can trigger. */
  minHoldMs: number
}

export interface MovementSignal {
  exercise: ExerciseId
  action: GameAction
  /** 0..1 quality of the completed movement. */
  quality: number
  repNumber: number
}

export interface RepEvent {
  exercise: ExerciseId
  /** 0..1 quality of the completed movement. */
  quality: number
  repNumber: number
}

export interface PoseAnalysisResult {
  landmarks: PoseLandmarks | null
  detected: boolean
  confidence: number
  angles: JointAngles
  /** Focus exercise chosen for this session. */
  exercise: ExerciseId | 'none'
  /** Exercise currently recognized as in-progress (may differ from focus). */
  activeExercise: ExerciseId | 'none'
  phase: MovementPhase
  /** 0..1 progress into the focus exercise range of motion. */
  depth: number
  /** Pulses true on the frame the focus repetition completes. */
  repCompleted: boolean
  repCount: number
  /** Repetitions completed this frame, for any recognized exercise. */
  repEvents: RepEvent[]
  /** Whether the player is holding a pose long enough to charge. */
  holdActive: boolean
  holdProgress: number
  arms: { leftUp: boolean; rightUp: boolean; bothUp: boolean }
  squatDepth: number
  kneeRaised: boolean
  feedback: string
  /** Posture alignment acceptable for scoring. */
  validForm: boolean
}

export interface AdaptiveMetrics {
  completionRate: number // 0..1 reps completed vs expected
  missedReps: number
  avgConfidence: number // 0..1
  avgReactionMs: number
}

export interface SessionStats {
  startedAt: number
  endedAt: number
  durationMs: number
  reps: number
  validReps: number
  score: number
  xpEarned: number
  avgConsistency: number // 0..100
  avgConfidence: number // 0..1
  peakCombo: number
  difficulty: DifficultyId
  outcome: 'victory' | 'gameover' | 'quit'
  exerciseIds: ExerciseId[]
  simulated: boolean
}

export interface Settings {
  difficulty: DifficultyId
  sound: boolean
  selectedExercise: ExerciseId
  gameMode: GameModeId
  /** Explicit player-selected intensity cap; adaptation never exceeds it. */
  maxIntensity: 'low' | 'medium' | 'high'
}

export interface ProgressState {
  xp: number
  level: number
  totalSessions: number
  totalReps: number
  achievements: string[]
  history: SessionStats[]
}
