import type { GestureName, NormalizedLandmark } from './gestures'

export type InputSource = 'demo' | 'camera'

export interface TrackedHand {
  id: string
  gesture: GestureName
  fingerCount: number
  x: number
  y: number
  depth: number
  velocity: number
  landmarks: NormalizedLandmark[]
}

export interface GestureFrame {
  hands: TrackedHand[]
  source: InputSource
  timestamp: number
}
