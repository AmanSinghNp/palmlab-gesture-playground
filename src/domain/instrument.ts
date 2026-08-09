import type { GestureName } from './gestures'

export type Mode = 'SCULPT' | 'DJ' | 'PHYSICS'
export type InputSource = 'demo' | 'camera'
export type MaterialPreset = 'chrome' | 'clay' | 'ink' | 'signal'
export type DjShape = 'cube' | 'sphere' | 'torus' | 'particles'

export interface TrackedHand {
  id: string
  gesture: GestureName
  fingerCount: number
  x: number
  y: number
  depth: number
  velocity: number
  landmarks: Array<{ x: number; y: number; z?: number }>
}

export interface GestureFrame {
  hands: TrackedHand[]
  source: InputSource
  timestamp: number
}

export const MODES: Record<Mode, {
  title: string
  description: string
  action: string
  hint: string
}> = {
  SCULPT: {
    title: 'Shape matter',
    description: 'Pinch to pull the surface. Bring in a second hand to scale the form.',
    action: 'Pinch / grab',
    hint: 'Wrist angle rolls the object',
  },
  DJ: {
    title: 'Play the signal',
    description: 'Change the instrument with your fingers. Hand movement bends color and distortion.',
    action: 'Finger count',
    hint: 'Swipe left / right to switch form',
  },
  PHYSICS: {
    title: 'Bend the field',
    description: 'Grab, throw, freeze, and release a live field of bodies and particles.',
    action: 'Grab / throw',
    hint: 'Space freezes · E triggers a burst',
  },
}

export const MATERIALS: Array<{ id: MaterialPreset; label: string; swatch: string }> = [
  { id: 'chrome', label: 'Chrome', swatch: '#c9d4ca' },
  { id: 'clay', label: 'Clay', swatch: '#bd7359' },
  { id: 'ink', label: 'Ink', swatch: '#1f2922' },
  { id: 'signal', label: 'Signal', swatch: '#c8ff35' },
]

export const DJ_SHAPES: Array<{ id: DjShape; label: string; key: string }> = [
  { id: 'cube', label: 'Cube', key: '01' },
  { id: 'sphere', label: 'Sphere', key: '02' },
  { id: 'torus', label: 'Torus', key: '03' },
  { id: 'particles', label: 'Field', key: '04' },
]
