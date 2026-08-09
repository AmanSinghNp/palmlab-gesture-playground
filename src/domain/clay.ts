import type { GestureFrame, TrackedHand } from './instrument'

export type ClayDeformation = 'idle' | 'stretch' | 'compress'

export interface ClayPosition {
  x: number
  y: number
  depth: number
}

export interface ClayPoint {
  x: number
  y: number
}

export interface ClayControls {
  position: ClayPosition
  scale: number
  rotation: number
  pinchPoints: ClayPoint[]
  deformation: ClayDeformation
}

const DEFAULT_POSITION: ClayPosition = { x: 0.5, y: 0.5, depth: 0 }
const MIN_SCALE = 0.45
const MAX_SCALE = 2.8

function finiteOr(value: number | undefined, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function handPosition(hand: TrackedHand): ClayPosition {
  return {
    x: finiteOr(hand.x, DEFAULT_POSITION.x),
    y: finiteOr(hand.y, DEFAULT_POSITION.y),
    depth: finiteOr(hand.depth, DEFAULT_POSITION.depth),
  }
}

function pinchPoint(hand: TrackedHand): ClayPoint {
  const thumb = hand.landmarks[4]
  const index = hand.landmarks[8]
  if (thumb && index && [thumb.x, thumb.y, index.x, index.y].every(Number.isFinite)) {
    return {
      x: (thumb.x + index.x) / 2,
      y: 1 - (thumb.y + index.y) / 2,
    }
  }

  const position = handPosition(hand)
  return { x: position.x, y: position.y }
}

function wristRotation(hand: TrackedHand) {
  const wrist = hand.landmarks[0]
  const middleMcp = hand.landmarks[9]
  if (!wrist || !middleMcp) return null

  const x = middleMcp.x - wrist.x
  const y = middleMcp.y - wrist.y
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) < Number.EPSILON) return null
  return Math.atan2(y, x)
}

function circularMean(angles: number[]) {
  if (angles.length === 0) return 0
  const sine = angles.reduce((sum, angle) => sum + Math.sin(angle), 0)
  const cosine = angles.reduce((sum, angle) => sum + Math.cos(angle), 0)
  if (Math.hypot(sine, cosine) < Number.EPSILON) return 0
  return Math.atan2(sine, cosine)
}

export function deriveClayControls(hands: readonly TrackedHand[], referenceSpan = 0.34): ClayControls {
  const pair = hands.slice(0, 2)
  if (pair.length === 0) {
    return {
      position: { ...DEFAULT_POSITION },
      scale: 1,
      rotation: 0,
      pinchPoints: [],
      deformation: 'idle',
    }
  }

  const positions = pair.map(handPosition)
  const position = positions.reduce((midpoint, hand) => ({
    x: midpoint.x + hand.x / positions.length,
    y: midpoint.y + hand.y / positions.length,
    depth: midpoint.depth + hand.depth / positions.length,
  }), { x: 0, y: 0, depth: 0 })
  const safeReferenceSpan = finiteOr(referenceSpan, 0.34)
  const span = pair.length === 2
    ? Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y)
    : safeReferenceSpan
  const scale = safeReferenceSpan > 0
    ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, span / safeReferenceSpan))
    : 1
  const rotations = pair.map(wristRotation).filter((rotation): rotation is number => rotation !== null)
  const pinchPoints = pair.filter((hand) => hand.gesture === 'pinch').map(pinchPoint)

  return {
    position,
    scale,
    rotation: circularMean(rotations),
    pinchPoints,
    deformation: pinchPoints.length >= 2 ? 'compress' : pinchPoints.length === 1 ? 'stretch' : 'idle',
  }
}

function demoLandmarks(x: number, y: number, rotation: number, pinch: boolean) {
  const yDown = 1 - y
  const landmarks = Array.from({ length: 21 }, () => ({ x, y: yDown, z: 0 }))
  landmarks[0] = { x, y: yDown, z: 0 }
  landmarks[9] = {
    x: x + Math.cos(rotation) * 0.18,
    y: yDown + Math.sin(rotation) * 0.18,
    z: 0,
  }
  landmarks[4] = { x: x - 0.04, y: yDown - 0.03, z: 0 }
  landmarks[8] = { x: x + (pinch ? 0.04 : 0.15), y: yDown - 0.03, z: 0 }
  return landmarks
}

function demoHand(id: string, x: number, y: number, rotation: number, pinch: boolean, velocity: number): TrackedHand {
  return {
    id,
    gesture: pinch ? 'pinch' : 'neutral',
    fingerCount: pinch ? 2 : 0,
    x,
    y,
    depth: 0,
    velocity,
    landmarks: demoLandmarks(x, y, rotation, pinch),
  }
}

/** A repeatable two-hand signal: neutral, one pinch, then two pinches. */
export function createDemoFrame(step: number): GestureFrame {
  const safeStep = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : 0
  const phase = safeStep % 3
  const drift = Math.sin(safeStep * 0.17) * 0.1
  const lift = Math.cos(safeStep * 0.13) * 0.06
  const leftPinch = phase >= 1
  const rightPinch = phase === 2

  return {
    hands: [
      demoHand('demo-left', 0.32 + drift, 0.54 + lift, -0.34, leftPinch, 0.22),
      demoHand('demo-right', 0.68 + drift, 0.48 + lift, Math.PI + 0.24, rightPinch, 0.28),
    ],
    source: 'demo',
    timestamp: safeStep * 160,
  }
}
