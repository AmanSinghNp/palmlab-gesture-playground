import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ClayControls } from '../domain/clay'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export interface StageProps {
  controls: ClayControls
}

const clayColor = '#bd7359'
const stageBackground = '#111512'

function normalizeDirection(x: number, y: number) {
  const length = Math.hypot(x, y)
  if (length < Number.EPSILON) return { x: 1, y: 0 }
  return { x: x / length, y: y / length }
}

function targetVertex(
  x: number,
  y: number,
  z: number,
  controls: ClayControls,
) {
  if (controls.deformation === 'stretch' && controls.pinchPoints[0]) {
    const point = controls.pinchPoints[0]
    const direction = normalizeDirection(
      (point.x - controls.position.x) * 1.7,
      (controls.position.y - point.y) * 1.7,
    )
    const projection = Math.max(0, x * direction.x + y * direction.y)
    const influence = Math.min(1, projection / 1.12)
    return {
      x: x + direction.x * influence * 0.58,
      y: y + direction.y * influence * 0.58,
      z: z * (1 + influence * 0.12),
    }
  }

  if (controls.deformation === 'compress' && controls.pinchPoints.length >= 2) {
    const first = controls.pinchPoints[0]
    const second = controls.pinchPoints[1]
    const direction = normalizeDirection(
      (second.x - first.x) * 1.7,
      (first.y - second.y) * 1.7,
    )
    const perpendicular = { x: -direction.y, y: direction.x }
    const along = x * direction.x + y * direction.y
    const across = x * perpendicular.x + y * perpendicular.y
    return {
      x: direction.x * along * 0.64 + perpendicular.x * across * 1.08,
      y: direction.y * along * 0.64 + perpendicular.y * across * 1.08,
      z: z * 1.04,
    }
  }

  return { x, y, z }
}

function ClaySphere({ controls, reducedMotion }: StageProps & { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const mesh = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => new THREE.SphereGeometry(1.08, 48, 32), [])
  const basePositions = useMemo(() => Float32Array.from(geometry.attributes.position.array), [geometry])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }, delta) => {
    if (!group.current || !mesh.current) return

    const elapsed = clock.getElapsedTime()
    const position = controls.position
    group.current.position.set(
      (position.x - 0.5) * 2.35,
      (position.y - 0.5) * -1.85,
      -position.depth * 1.8,
    )
    group.current.scale.setScalar(controls.scale)
    group.current.rotation.set(
      reducedMotion ? 0 : Math.sin(elapsed * 0.32) * 0.025,
      reducedMotion ? 0 : Math.sin(elapsed * 0.24) * 0.02,
      controls.rotation,
    )

    const positions = geometry.attributes.position
    const values = positions.array as Float32Array
    const blend = Math.min(1, delta * (reducedMotion ? 24 : 9))
    for (let index = 0; index < values.length; index += 3) {
      const target = targetVertex(
        basePositions[index],
        basePositions[index + 1],
        basePositions[index + 2],
        controls,
      )
      values[index] += (target.x - values[index]) * blend
      values[index + 1] += (target.y - values[index + 1]) * blend
      values[index + 2] += (target.z - values[index + 2]) * blend
    }
    positions.needsUpdate = true
    geometry.computeVertexNormals()
  })

  return (
    <group ref={group}>
      <mesh ref={mesh} geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={clayColor}
          roughness={0.34}
          metalness={0.08}
          clearcoat={0.42}
          clearcoatRoughness={0.28}
        />
      </mesh>
    </group>
  )
}

function StageScene({ controls, reducedMotion }: StageProps & { reducedMotion: boolean }) {
  return (
    <>
      <color attach="background" args={[stageBackground]} />
      <fog attach="fog" args={[stageBackground, 4.5, 9]} />
      <ambientLight intensity={1.7} color="#b7c7b5" />
      <directionalLight position={[2, 4, 4]} intensity={4} color="#d5dfd3" />
      <pointLight position={[-3, 1, 2]} intensity={4.5} distance={8} color="#c8ff35" />
      <gridHelper args={[10, 20, '#304034', '#1e291f']} position={[0, -1.55, 0]} />
      <ClaySphere controls={controls} reducedMotion={reducedMotion} />
    </>
  )
}

export function Stage({ controls }: StageProps) {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: false }}
      camera={{ position: [0, 0.2, 5.8], fov: 39 }}
      aria-label="Interactive deformable clay sphere"
    >
      <StageScene controls={controls} reducedMotion={reducedMotion} />
    </Canvas>
  )
}
