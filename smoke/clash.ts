/* Clash pipeline smoke tests (headless, deterministic).
 * Run: npm run test:clash
 */
import { computeAngles } from '../src/analysis/angles.ts'
import { LM, type JointAngles, type PoseLandmarks } from '../src/types.ts'
import { getPose } from '../src/clash/referencePoses.ts'
import { getCombo } from '../src/clash/ghostCombos.ts'
import { sampleCombo } from '../src/clash/ghost.ts'
import { poseTargets, skeletonFromTargets } from '../src/clash/ghostSkeleton.ts'
import { scoreAction, scoreFlow } from '../src/clash/scoring.ts'
import { LandmarkSmoother } from '../src/clash/smoothing.ts'
import { StrikeDetector } from '../src/clash/strikes.ts'
import { ClashRecorder } from '../src/clash/report.ts'

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg)
    process.exit(1)
  }
  console.log('ok:', msg)
}

function fakeAngles(over: Partial<JointAngles>): JointAngles {
  return {
    leftElbow: 170, rightElbow: 170,
    leftShoulder: 15, rightShoulder: 15,
    leftHip: 175, rightHip: 175,
    leftKnee: 175, rightKnee: 175,
    leftAnkle: 170, rightAnkle: 170,
    trunkInclination: 3,
    ...over,
  }
}

// 1. Flow scoring: perfect mountain ~= 100, slouched mountain defects.
const mountain = getPose('mountain')
const perfect = scoreFlow(fakeAngles({}), mountain)
console.log('mountain perfect:', perfect.accuracy, JSON.stringify(perfect.defects))
assert(perfect.accuracy >= 95, `perfect mountain scores high (${perfect.accuracy})`)
const slouch = scoreFlow(fakeAngles({ trunkInclination: 30, leftKnee: 150 }), mountain)
console.log('mountain slouch:', slouch.accuracy, slouch.defects.map((d) => `${d.joint}:${Math.round(d.user)}`).join(','))
assert(slouch.accuracy < 80, `slouch penalized (${slouch.accuracy})`)
assert(slouch.defects.length >= 1, 'defects identified')

// 2. Combo sampling interpolates between keyframes.
const combo = getCombo('jab-cross-hook')
const s0 = sampleCombo(combo, 0, 0)
const sMid = sampleCombo(combo, 600, 0) // between jab(400) and guard(800)
console.log('combo t=0:', s0.label, JSON.stringify(s0.targets.leftElbow))
console.log('combo t=600:', sMid.label, JSON.stringify(sMid.targets.leftElbow))
assert(s0.targets.leftElbow === 95, 'combo starts at guard')
assert(
  (sMid.targets.leftElbow ?? 0) > 95 && (sMid.targets.leftElbow ?? 0) < 155,
  'combo interpolates jab->guard',
)

// 3. Synthesized ghost skeleton recovers elbow targets approximately.
for (const elbow of [95, 130, 160]) {
  const skel = skeletonFromTargets({ leftShoulder: 45, leftElbow: elbow })
  const a = computeAngles(skel)
  console.log(`ghost elbow target=${elbow} measured=${a.leftElbow.toFixed(1)}`)
  assert(Math.abs(a.leftElbow - elbow) < 12, `ghost elbow ~${elbow} (got ${a.leftElbow.toFixed(1)})`)
}

// 4. Action scoring against live combo targets.
const live = scoreAction(fakeAngles({ leftElbow: 150, leftShoulder: 60 }), { leftElbow: 155, leftShoulder: 62 })
assert(live.accuracy >= 80, `action match scores high (${live.accuracy})`)

// 5. Strike detection: fast jab-like extension fires 'jab'.
{
  const det = new StrikeDetector()
  const guard = skeletonFromTargets({ leftShoulder: 45, leftElbow: 95, rightShoulder: 45, rightElbow: 95 })
  const jab = skeletonFromTargets({ leftShoulder: 62, leftElbow: 155, rightShoulder: 45, rightElbow: 95 })
  const lerp = (a: PoseLandmarks, b: PoseLandmarks, f: number, z: number): PoseLandmarks =>
    a.map((p, i) => ({
      x: p.x + (b[i].x - p.x) * f,
      y: p.y + (b[i].y - p.y) * f,
      z: (p.z ?? 0) + z * f,
      visibility: 0.95,
    }))
  let now = 1000
  const dt = 33
  det.update(guard, computeAngles(guard), now)
  let fired: string[] = []
  // Punch lands over ~100ms (3 fast frames), fist drives toward camera.
  for (const f of [0.5, 1, 1]) {
    now += dt
    const fr = lerp(guard, jab, f, -0.15 * f)
    for (const st of det.update(fr, computeAngles(fr), now)) fired.push(st.kind)
  }
  console.log('jab fired:', fired.join(',') || '(none)')
  assert(fired.includes('jab'), 'fast extension registers a jab')
}

// 6. Kick detection: foot whips up past the hip.
{
  const det = new StrikeDetector()
  const base = skeletonFromTargets({})
  const at = (x: number, y: number): PoseLandmarks =>
    base.map((p, i) =>
      i === LM.LEFT_ANKLE ? { x, y, z: 0, visibility: 0.95 } : p,
    )
  let now = 5000
  det.update(at(0.44, 0.8), computeAngles(at(0.44, 0.8)), now)
  let fired: string[] = []
  for (const [x, y] of [[0.43, 0.68], [0.42, 0.56], [0.41, 0.48]] as const) {
    now += 33
    const fr = at(x, y)
    for (const st of det.update(fr, computeAngles(fr), now)) fired.push(st.kind)
  }
  console.log('kick fired:', fired.join(',') || '(none)')
  assert(fired.includes('kick'), 'rising foot registers a kick')
}

// 7. Smoother keeps shape and kills single-frame spikes.
{
  const sm = new LandmarkSmoother(3)
  const calm = skeletonFromTargets({})
  let out = calm
  for (let i = 0; i < 3; i++) out = sm.push(calm) ?? calm
  const spike = calm.map((p, i) =>
    i === LM.LEFT_WRIST ? { ...p, x: p.x + 0.5 } : p,
  )
  const soft = sm.push(spike)
  const dx = Math.abs((soft?.[LM.LEFT_WRIST]?.x ?? 0) - calm[LM.LEFT_WRIST].x)
  console.log('spike residual:', dx.toFixed(3))
  assert(dx < 0.2, 'frame buffer damps spikes')
}

// 8. Recorder builds a sane report payload.
{
  const rec = new ClashRecorder()
  rec.sample(80)
  rec.sample(90)
  rec.strike('jab')
  rec.syncSample(12)
  const rep = rec.build({
    mode: 'action', referenceName: 'Jab · Cross · Hook', rival: 'Ideal ghost',
    startedAt: 0, endedAt: 60000,
  })
  console.log('report:', JSON.stringify(rep))
  assert(rep.avgAccuracy === 85 && rep.strikes.jab === 1 && rep.peakSyncMs === 12, 'report fields correct')
}

console.log('ALL CLASH TESTS PASSED')
