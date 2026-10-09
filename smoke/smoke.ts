/* Headless smoke test: simulator -> analyzer -> engine.
 * Run with: npx esbuild smoke/smoke.ts --bundle --platform=node --format=cjs --outfile=/tmp/smoke.cjs && node /tmp/smoke.cjs
 */
import { MovementAnalyzer } from '../src/analysis/analyzer.ts'
import { GameEngine } from '../src/game/engine.ts'
import { PoseSimulator } from '../src/pose/simulator.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('ok:', msg)
}

// Keep the simulator on one exercise for predictable rep rates.
const sim = new PoseSimulator()
sim.setExercise('arm-raise')

const analyzer = new MovementAnalyzer({ focusExercise: 'arm-raise' })
const engine = new GameEngine({ difficulty: 'standard', maxIntensity: 'medium' }, 0)
engine.start(0)

let reps = 0
let now = 0
const dt = 33
// Simulate ~60s at 30fps.
for (let i = 0; i < 1800; i++) {
  now += dt
  const lms = sim.step(now)
  const result = analyzer.update(lms, dt)
  reps += result.repEvents.length
  if (i === 100) {
    console.log(
      `sample angles L/R shoulder: ${result.angles.leftShoulder.toFixed(1)}/${result.angles.rightShoulder.toFixed(1)} ` +
        `conf=${result.confidence.toFixed(2)} detected=${result.detected} depth=${result.depth.toFixed(2)}`,
    )
  }
  engine.processPose(result, now)
  engine.tick(dt, now)
  if (engine.state.status !== 'running') break
}

console.log(
  `reps=${reps} score=${engine.state.score} enemyHp=${engine.state.enemy.hp} ` +
    `playerHp=${engine.state.player.hp} status=${engine.state.status} combo=${engine.state.peakCombo}`,
)
assert(reps >= 3, `reps counted (${reps})`)
assert(engine.state.score > 0, 'score increased')
assert(engine.state.enemy.hp < engine.state.enemy.maxHp, 'enemy took damage')

// Squat mapping -> charge builds energy.
const sim2 = new PoseSimulator()
sim2.setExercise('squat')
const analyzer2 = new MovementAnalyzer({ focusExercise: 'squat' })
const engine2 = new GameEngine({ difficulty: 'gentle', maxIntensity: 'low' }, 0)
engine2.start(0)
let now2 = 0
let squatReps = 0
for (let i = 0; i < 900; i++) {
  now2 += dt
  const result = analyzer2.update(sim2.step(now2), dt)
  squatReps += result.repEvents.length
  engine2.processPose(result, now2)
  engine2.tick(dt, now2)
  if (engine2.state.status !== 'running') break
}
console.log(`squat reps=${squatReps} energy=${engine2.state.player.energy}`)
assert(squatReps >= 2, `squat reps counted (${squatReps})`)
assert(engine2.state.player.energy > 0, 'charge built energy')

// Every exercise must be countable by the state machine.
import type { ExerciseId } from '../src/types.ts'
for (const ex of ['squat', 'arm-raise', 'lateral-raise', 'knee-lift'] as ExerciseId[]) {
  const s = new PoseSimulator()
  s.setExercise(ex)
  const a = new MovementAnalyzer({ focusExercise: ex })
  let n = 0
  let t = 0
  for (let i = 0; i < 500; i++) {
    t += dt
    n += a.update(s.step(t), dt).repEvents.length
  }
  console.log(`${ex}: reps=${n}`)
  assert(n >= 2, `${ex} reps counted (${n})`)
}

// Confidence gate: null landmarks must not score.
const analyzer3 = new MovementAnalyzer({ focusExercise: 'squat' })
const r = analyzer3.update(null, 33)
assert(r.detected === false && r.repEvents.length === 0, 'no scoring without pose')

console.log('ALL SMOKE TESTS PASSED')
