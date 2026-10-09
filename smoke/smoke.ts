/* Headless smoke test: verify the game does not score without camera landmarks. */
import { MovementAnalyzer } from '../src/analysis/analyzer.ts'
import { GameEngine } from '../src/game/engine.ts'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error('FAIL:', message)
    process.exit(1)
  }
  console.log('ok:', message)
}

const analyzer = new MovementAnalyzer({ focusExercise: 'squat' })
const engine = new GameEngine({ difficulty: 'standard', maxIntensity: 'medium' }, 0)
engine.start(0)

for (let i = 0; i < 12; i++) {
  const result = analyzer.update(null, 33)
  engine.processPose(result, i * 33)
  engine.tick(33, i * 33)
}

assert(engine.state.reps === 0, 'no repetitions are counted without camera pose')
assert(engine.state.score === 0, 'no score is awarded without camera pose')
assert(engine.state.enemy.hp === engine.state.enemy.maxHp, 'enemy takes no damage without movement')
console.log('ALL SMOKE TESTS PASSED')
