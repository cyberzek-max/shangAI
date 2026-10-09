import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { GameEngine } from '../game/engine'

export interface FramePose {
  depth: number
  squatDepth: number
  leftUp: boolean
  rightUp: boolean
  bothUp: boolean
}

const PLAYER_POS: [number, number, number] = [-2.3, 0, 0.9]
const ENEMY_POS: [number, number, number] = [2.3, 0, -0.9]

/* ------------------------------ floor ---------------------------------- */

function ArenaFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#0b1220" roughness={0.9} metalness={0.1} />
      </mesh>
      <gridHelper args={[18, 36, '#2bb8c9', '#1a2742']} position={[0, 0, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[3.4, 3.55, 64]} />
        <meshBasicMaterial color="#2bb8c9" transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[4.6, 4.66, 64]} />
        <meshBasicMaterial color="#7c5cf0" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ------------------------------ health bar ------------------------------ */

function HealthBar({
  position,
  ratioRef,
  width = 1.5,
}: {
  position: [number, number, number]
  ratioRef: React.MutableRefObject<number>
  width?: number
}) {
  const fg = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const scratch = useMemo(() => new THREE.Color(), [])
  const last = useRef(-1)
  useFrame(() => {
    const r = Math.max(0, Math.min(1, ratioRef.current))
    if (fg.current) {
      fg.current.scale.x = Math.max(0.001, r)
      fg.current.position.x = (-(1 - r) * width) / 2
    }
    if (mat.current && Math.abs(r - last.current) > 0.005) {
      last.current = r
      scratch.setHSL(r * 0.33, 0.85, 0.55)
      mat.current.color.copy(scratch)
    }
  })
  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[width, 0.12]} />
        <meshBasicMaterial color="#0b1220" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={fg} position={[0, 0, 0.001]}>
        <planeGeometry args={[width, 0.1]} />
        <meshBasicMaterial ref={mat} color="#4fd6e0" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ------------------------------- player --------------------------------- */

function PlayerRig({
  engine,
  poseRef,
}: {
  engine: GameEngine
  poseRef: React.MutableRefObject<FramePose>
}) {
  const group = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const torsoMat = useRef<THREE.MeshStandardMaterial>(null)
  const shield = useRef<THREE.Mesh>(null)
  const ratio = useRef(1)
  const flash = useRef(0)
  const lastHp = useRef(100)

  useFrame((state, dt) => {
    const s = engine.state
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const pose = poseRef.current
    const squat = Math.max(0, Math.min(1, pose.squatDepth))

    g.position.y = -squat * 0.45 + Math.sin(t * 2) * 0.02
    g.rotation.y = 0.6 + Math.sin(t * 0.4) * 0.03

    // Arms mirror the detected pose (clamped, damped).
    const lTarget = pose.bothUp ? -2.85 : pose.leftUp ? -2.4 : -0.14
    const rTarget = pose.bothUp ? 2.85 : pose.rightUp ? 2.4 : 0.14
    const k = Math.min(1, dt * 9)
    if (armL.current) armL.current.rotation.z += (lTarget - armL.current.rotation.z) * k
    if (armR.current) armR.current.rotation.z += (rTarget - armR.current.rotation.z) * k

    if (torsoMat.current) {
      if (s.player.hp < lastHp.current) flash.current = 1
      lastHp.current = s.player.hp
      flash.current = Math.max(0, flash.current - dt * 4)
      torsoMat.current.emissive.setRGB(flash.current * 0.9, 0.05, 0.1)
    }
    if (shield.current) {
      shield.current.visible = s.player.shieldMs > 0
      shield.current.rotation.y += dt * 1.5
    }
    ratio.current = s.player.hp / s.player.maxHp
  })

  return (
    <group position={PLAYER_POS}>
      <group ref={group} rotation={[0, 0.6, 0]}>
        {/* legs */}
        <mesh position={[-0.16, 0.35, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.24]} />
          <meshStandardMaterial color="#1a2742" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0.16, 0.35, 0]}>
          <boxGeometry args={[0.22, 0.7, 0.24]} />
          <meshStandardMaterial color="#1a2742" roughness={0.6} metalness={0.4} />
        </mesh>
        {/* torso */}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[0.62, 0.75, 0.4]} />
          <meshStandardMaterial
            ref={torsoMat}
            color="#243457"
            roughness={0.45}
            metalness={0.55}
            emissive="#000000"
          />
        </mesh>
        {/* chest core */}
        <mesh position={[0, 1.12, 0.21]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color="#4fd6e0" emissive="#4fd6e0" emissiveIntensity={2} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.62, 0]}>
          <sphereGeometry args={[0.2, 20, 20]} />
          <meshStandardMaterial color="#31456b" roughness={0.4} metalness={0.6} />
        </mesh>
        <mesh position={[0, 1.62, 0.15]}>
          <boxGeometry args={[0.26, 0.07, 0.05]} />
          <meshStandardMaterial color="#4fd6e0" emissive="#4fd6e0" emissiveIntensity={2.4} />
        </mesh>
        {/* arms on shoulder pivots */}
        <group ref={armL} position={[-0.42, 1.32, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <boxGeometry args={[0.18, 0.64, 0.2]} />
            <meshStandardMaterial color="#243457" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.62, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#4fd6e0" emissive="#4fd6e0" emissiveIntensity={1.6} />
          </mesh>
        </group>
        <group ref={armR} position={[0.42, 1.32, 0]}>
          <mesh position={[0, -0.32, 0]}>
            <boxGeometry args={[0.18, 0.64, 0.2]} />
            <meshStandardMaterial color="#243457" roughness={0.5} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.62, 0]}>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color="#9a7cf5" emissive="#9a7cf5" emissiveIntensity={1.6} />
          </mesh>
        </group>
        {/* shield bubble */}
        <mesh ref={shield} position={[0, 1, 0]} visible={false}>
          <sphereGeometry args={[1.05, 24, 24]} />
          <meshBasicMaterial color="#4fd6e0" transparent opacity={0.14} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <HealthBar position={[0, 2.25, 0]} ratioRef={ratio} />
    </group>
  )
}

/* -------------------------------- enemy ---------------------------------- */

function EnemyRig({ engine }: { engine: GameEngine }) {
  const group = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const coreMat = useRef<THREE.MeshStandardMaterial>(null)
  const spikes = useRef<THREE.Group>(null)
  const ratio = useRef(1)

  useFrame((state, dt) => {
    const s = engine.state
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const windup = s.enemy.windup
    g.position.y = 1.5 + Math.sin(t * 1.5) * 0.12
    g.position.x = Math.sin(t * 0.6) * 0.35
    // Lunge toward the player as the attack winds up.
    const lunge = windup * 1.1
    g.position.z = -lunge * 0.7
    g.position.x += -lunge * 0.45
    const sc = 1 + windup * 0.25
    g.scale.setScalar(sc)
    if (spikes.current) spikes.current.rotation.y += dt * (1 + windup * 6)
    if (core.current) core.current.rotation.y -= dt * 2
    if (coreMat.current) coreMat.current.emissiveIntensity = 1.4 + windup * 4
    ratio.current = s.enemy.hp / s.enemy.maxHp
  })

  return (
    <group position={ENEMY_POS}>
      <group ref={group} rotation={[0, -0.6, 0]}>
        <mesh ref={core}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial
            ref={coreMat}
            color="#3a1030"
            roughness={0.3}
            metalness={0.7}
            emissive="#e04f7a"
            emissiveIntensity={1.4}
          />
        </mesh>
        <group ref={spikes}>
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={i}
              position={[Math.cos((i * Math.PI) / 2) * 0.75, 0, Math.sin((i * Math.PI) / 2) * 0.75]}
              rotation={[0, -(i * Math.PI) / 2, Math.PI / 2]}
            >
              <coneGeometry args={[0.14, 0.55, 6]} />
              <meshStandardMaterial color="#243457" roughness={0.4} metalness={0.7} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, -0.85, 0]}>
          <torusGeometry args={[0.4, 0.05, 10, 32]} />
          <meshStandardMaterial color="#7c5cf0" emissive="#7c5cf0" emissiveIntensity={1.2} />
        </mesh>
      </group>
      <HealthBar position={[0, 2.7, 0]} ratioRef={ratio} width={1.7} />
    </group>
  )
}

/* -------------------------------- effects --------------------------------- */

interface VisualFx {
  id: number
  kind: string
  at: 'player' | 'enemy'
  born: number
  ttl: number
}

function FxItem({ fx }: { fx: VisualFx }) {
  const ring = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const pos: [number, number, number] =
    fx.at === 'player'
      ? [PLAYER_POS[0], 1.1, PLAYER_POS[2]]
      : [ENEMY_POS[0], 1.5, ENEMY_POS[2]]
  const color = fx.kind === 'player-hit' ? '#e04f7a' : fx.kind === 'special' ? '#9a7cf5' : '#4fd6e0'

  useFrame(() => {
    const p = Math.max(0, Math.min(1, (performance.now() - fx.born) / fx.ttl))
    if (ring.current) {
      const s = 0.4 + p * (fx.kind === 'special' ? 3.4 : 2.2)
      ring.current.scale.setScalar(s)
    }
    if (mat.current) mat.current.opacity = 0.85 * (1 - p)
  })

  return (
    <mesh ref={ring} position={pos} rotation={[-Math.PI / 2.4, 0, 0]}>
      <ringGeometry args={[0.5, 0.62, 40]} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function FxLayer({ engine }: { engine: GameEngine }) {
  const [items, setItems] = useState<VisualFx[]>([])
  const seen = useRef<Set<number>>(new Set())

  useFrame(() => {
    const live = engine.state.effects
    const liveIds = new Set(live.map((e) => e.id))
    const adds = live.filter((e) => !seen.current.has(e.id))
    if (adds.length > 0) {
      seen.current = liveIds
      const visuals: VisualFx[] = adds.map((e) => ({
        id: e.id,
        kind: e.kind,
        at: e.at,
        born: performance.now(),
        ttl: e.maxTtl,
      }))
      setItems((prev) => [...prev, ...visuals])
    }
    setItems((prev) => {
      if (prev.every((v) => liveIds.has(v.id))) return prev
      return prev.filter((v) => liveIds.has(v.id))
    })
  })

  return (
    <group>
      {items.map((fx) => (
        <FxItem key={fx.id} fx={fx} />
      ))}
    </group>
  )
}

/* --------------------------------- scene ---------------------------------- */

function CameraRig() {
  useFrame((state) => {
    const t = state.clock.elapsedTime
    state.camera.position.x = Math.sin(t * 0.12) * 0.35
    state.camera.position.y = 3.1 + Math.sin(t * 0.2) * 0.1
    state.camera.lookAt(0, 1.2, 0)
  })
  return null
}

export function ArenaScene({
  engine,
  poseRef,
}: {
  engine: GameEngine
  poseRef: React.MutableRefObject<FramePose>
}) {
  return (
    <Canvas
      camera={{ position: [0, 3.1, 8.2], fov: 52 }}
      gl={{ antialias: true }}
      dpr={[1, 1.75]}
    >
      <color attach="background" args={['#070b16']} />
      <fog attach="fog" args={['#070b16', 11, 26]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 7, 4]} intensity={1.4} color="#cfe9ff" />
      <pointLight position={[-4, 3, 3]} intensity={18} distance={16} color="#2bb8c9" />
      <pointLight position={[4, 2, -3]} intensity={22} distance={16} color="#7c5cf0" />
      <ArenaFloor />
      <PlayerRig engine={engine} poseRef={poseRef} />
      <EnemyRig engine={engine} />
      <FxLayer engine={engine} />
      <CameraRig />
    </Canvas>
  )
}
