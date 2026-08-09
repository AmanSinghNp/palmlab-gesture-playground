import { useFrame } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import * as THREE from 'three'
import type { DjShape, MaterialPreset, Mode } from '../domain/instrument'

interface StageProps {
  mode: Mode
  material: MaterialPreset
  djShape: DjShape
  handPosition: { x: number; y: number; depth: number; rotation: number; velocity: number }
  handScale: number
  gesture: string
  frozen: boolean
  cuePulse: number
}

const materialColors: Record<MaterialPreset, string> = {
  chrome: '#c9d4ca',
  clay: '#bd7359',
  ink: '#172019',
  signal: '#c8ff35',
}

const handColor = '#c8ff35'

function CoreObject({ mode, material, shape, handPosition, handScale, gesture, frozen, cuePulse, reducedMotion }: Omit<StageProps, 'djShape'> & { shape: DjShape; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const color = mode === 'DJ'
    ? new THREE.Color(`hsl(${160 + handPosition.x * 160} ${78 + handPosition.y * 14}% ${52 + handPosition.y * 10}%)`)
    : new THREE.Color(materialColors[material])

  useFrame(({ clock }, delta) => {
    if (!group.current || frozen || reducedMotion) return
    const elapsed = clock.getElapsedTime()
    const gestureLift = gesture === 'pinch' ? 0.12 : gesture === 'open-palm' ? -0.04 : 0
    const pulse = cuePulse ? Math.max(0, 1 - (Date.now() - cuePulse) / 800) : 0
    group.current.rotation.y += delta * (0.22 + handPosition.x * 0.28)
    group.current.rotation.x = Math.sin(elapsed * 0.55) * 0.13 + handPosition.y * 0.08
    group.current.rotation.z = handPosition.rotation * 0.42
    group.current.position.x = (handPosition.x - 0.5) * 1.35
    group.current.position.z = -handPosition.depth * 1.8
    group.current.position.y = Math.sin(elapsed * 0.8) * 0.08 + gestureLift
    group.current.scale.setScalar(handScale * (1 + pulse * 0.18 + handPosition.velocity * 0.08))
    if (core.current && mode === 'SCULPT') {
      core.current.rotation.z = Math.sin(elapsed * 0.3) * 0.18 + (handPosition.x - 0.5) * 0.7
    }
  })

  if (shape === 'particles') return <ParticleField frozen={frozen} color={color} pulse={cuePulse} reducedMotion={reducedMotion} />

  return (
    <group ref={group}>
      <mesh ref={core} castShadow receiveShadow>
        {shape === 'cube' && <boxGeometry args={[1.55, 1.55, 1.55, 5, 5, 5]} />}
        {shape === 'sphere' && <sphereGeometry args={[1.08, 48, 32]} />}
        {shape === 'torus' && <torusGeometry args={[0.78, 0.27, 24, 64]} />}
        <meshPhysicalMaterial
          color={color}
          roughness={mode === 'SCULPT' ? 0.28 : 0.48}
          metalness={material === 'chrome' ? 0.92 : material === 'ink' ? 0.62 : 0.18}
          clearcoat={0.6}
          clearcoatRoughness={0.18}
          wireframe={mode === 'SCULPT'}
        />
      </mesh>
      {mode === 'SCULPT' && (
        <mesh rotation={[0, 0, Math.PI / 4]} scale={1.25}>
          <icosahedronGeometry args={[1, 2]} />
          <meshBasicMaterial color={handColor} wireframe transparent opacity={0.08} />
        </mesh>
      )}
    </group>
  )
}

function ParticleField({ frozen, color, pulse, reducedMotion }: { frozen: boolean; color: THREE.Color; pulse: number; reducedMotion: boolean }) {
  const points = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const values = new Float32Array(520 * 3)
    for (let index = 0; index < values.length; index += 3) {
      const angle = (index / 3) * 2.39996
      const radius = 0.34 + ((index / 3) % 26) * 0.037
      values[index] = Math.cos(angle) * radius
      values[index + 1] = Math.sin(angle * 0.7) * radius * 0.75
      values[index + 2] = Math.sin(angle) * radius
    }
    return values
  }, [])

  useFrame(({ clock }, delta) => {
    if (!points.current || frozen || reducedMotion) return
    const pulseAmount = pulse ? Math.max(0, 1 - (Date.now() - pulse) / 800) : 0
    points.current.rotation.y += delta * (0.12 + pulseAmount * 0.5)
    points.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.35) * 0.12
    points.current.scale.setScalar(1 + pulseAmount * 0.3)
  })

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.038} sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

function PhysicsBodies({ frozen, cuePulse, handPosition, gesture, reducedMotion }: { frozen: boolean; cuePulse: number; handPosition: StageProps['handPosition']; gesture: string; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const bodies = useMemo(() => Array.from({ length: 18 }, (_, index) => ({
    x: ((index * 17) % 9 - 4) * 0.22,
    y: ((index * 23) % 8 - 3) * 0.19,
    z: ((index * 31) % 7 - 3) * 0.2,
    size: 0.08 + (index % 3) * 0.025,
  })), [])

  useFrame(({ clock }, delta) => {
    if (!group.current || frozen || reducedMotion) return
    const elapsed = clock.getElapsedTime()
    const burst = cuePulse ? Math.max(0, 1 - (Date.now() - cuePulse) / 800) : 0
    group.current.children.forEach((body, index) => {
      const seed = bodies[index]
      body.position.y = seed.y + Math.sin(elapsed * (0.7 + index * 0.03) + index) * 0.12
      const pinchPull = gesture === 'pinch' ? Math.max(0, 1 - index / bodies.length) * 0.18 : 0
      body.position.x = seed.x + Math.cos(elapsed * 0.45 + index) * 0.08 + (handPosition.x - 0.5) * pinchPull
      body.position.z = seed.z + Math.sin(elapsed * 0.4 + index) * 0.1 - handPosition.depth * pinchPull
      if (burst) body.position.multiplyScalar(1 + burst * 0.75)
      body.rotation.x += delta * (0.4 + index * 0.02)
      body.rotation.y += delta * 0.5
    })
  })

  return (
    <group ref={group}>
      {bodies.map((body, index) => (
        <mesh key={index} position={[body.x, body.y, body.z]} scale={body.size}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={index % 4 === 0 ? handColor : '#d0d8ce'} roughness={0.5} metalness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function StageScene({ mode, material, djShape, handPosition, handScale, gesture, frozen, cuePulse, reducedMotion }: StageProps & { reducedMotion: boolean }) {
  return (
    <>
      <color attach="background" args={['#111512']} />
      <fog attach="fog" args={['#111512', 4.5, 9]} />
      <ambientLight intensity={1.8} color="#b7c7b5" />
      <directionalLight position={[2, 4, 4]} intensity={4} color="#d5dfd3" />
      <pointLight position={[-3, 1, 2]} intensity={5} distance={8} color="#c8ff35" />
      <gridHelper args={[10, 20, '#304034', '#1e291f']} position={[0, -1.55, 0]} />
      {mode === 'PHYSICS' ? (
        <PhysicsBodies frozen={frozen} cuePulse={cuePulse} handPosition={handPosition} gesture={gesture} reducedMotion={reducedMotion} />
      ) : (
        <CoreObject
          mode={mode}
          material={material}
          shape={mode === 'SCULPT' ? 'sphere' : djShape}
          handPosition={handPosition}
          handScale={handScale}
          reducedMotion={reducedMotion}
          gesture={gesture}
          frozen={frozen}
          cuePulse={cuePulse}
        />
      )}
    </>
  )
}

export function Stage(props: StageProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 0.2, 5.8], fov: 39 }}
      aria-label="Interactive three-dimensional gesture stage"
    >
      <StageScene {...props} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
