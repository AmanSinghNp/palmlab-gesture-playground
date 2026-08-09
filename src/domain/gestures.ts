export interface NormalizedLandmark {
  x: number
  y: number
  z?: number
}

export type GestureName = 'pinch' | 'open-palm' | 'fist' | 'point' | 'neutral'

const fingerChains = [
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
] as const

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function countExtendedFingers(
  landmarks: NormalizedLandmark[],
  handedness: 'Left' | 'Right' = 'Right',
) {
  if (landmarks.length < 21) return 0

  const extended = fingerChains.reduce((count, [, pip, , tip]) => {
    return count + (landmarks[tip].y < landmarks[pip].y ? 1 : 0)
  }, 0)

  const thumbTip = landmarks[4]
  const thumbJoint = landmarks[3]
  const thumbIsExtended = handedness === 'Right'
    ? thumbTip.x < thumbJoint.x - 0.04
    : thumbTip.x > thumbJoint.x + 0.04

  return extended + (thumbIsExtended ? 1 : 0)
}

export function classifyGesture(landmarks: NormalizedLandmark[], handedness: 'Left' | 'Right' = 'Right'): GestureName {
  if (landmarks.length < 21) return 'neutral'

  const pinchDistance = distance(landmarks[4], landmarks[8])
  if (pinchDistance < 0.085) return 'pinch'

  const extended = countExtendedFingers(landmarks, handedness)
  if (extended >= 4) return 'open-palm'
  if (extended === 0) return 'fist'
  if (extended === 1 && landmarks[8].y < landmarks[6].y) return 'point'
  return 'neutral'
}

export function calculateTwoHandScale(currentDistance: number, initialDistance: number) {
  if (currentDistance <= 0 || initialDistance <= 0) return 1
  return Math.min(2.8, Math.max(0.45, currentDistance / initialDistance))
}

export interface MotionColor {
  hue: number
  saturation: number
  lightness: number
}

export function mapHandMotionToColor(x: number, y: number): MotionColor {
  const safeX = Math.min(1, Math.max(0, x))
  const safeY = Math.min(1, Math.max(0, y))
  return {
    hue: Math.round(160 + safeX * 160),
    saturation: Math.round(78 + safeY * 14),
    lightness: Math.round(52 + safeY * 10),
  }
}

export function calculateWristRotation(landmarks: NormalizedLandmark[]) {
  if (landmarks.length < 10) return 0
  return Math.atan2(landmarks[9].y - landmarks[0].y, landmarks[9].x - landmarks[0].x)
}
