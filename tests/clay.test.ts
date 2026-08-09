import { describe, expect, it } from 'vitest'
import { createDemoFrame, deriveClayControls } from '../src/domain/clay'
import type { TrackedHand } from '../src/domain/instrument'

const point = (x: number, y: number, z = 0) => ({ x, y, z })

function makeHand({
  id,
  x,
  y,
  depth = 0,
  wristAngle = 0,
  pinch = false,
}: {
  id: string
  x: number
  y: number
  depth?: number
  wristAngle?: number
  pinch?: boolean
}): TrackedHand {
  const landmarks = Array.from({ length: 21 }, () => point(x, y))
  landmarks[0] = point(x, y)
  landmarks[9] = point(x + Math.cos(wristAngle) * 0.2, y + Math.sin(wristAngle) * 0.2)
  landmarks[4] = point(x - 0.04, y + 0.03)
  landmarks[8] = point(pinch ? x + 0.04 : x + 0.16, y + 0.03)

  return {
    id,
    gesture: pinch ? 'pinch' : 'neutral',
    fingerCount: pinch ? 2 : 0,
    x,
    y,
    depth,
    velocity: 0,
    landmarks,
  }
}

describe('clay controls', () => {
  it('derives a neutral-safe midpoint from a hand pair', () => {
    expect(deriveClayControls([
      makeHand({ id: 'left', x: 0.2, y: 0.3, depth: -0.1 }),
      makeHand({ id: 'right', x: 0.8, y: 0.7, depth: 0.2 }),
    ]).position).toEqual({ x: 0.5, y: 0.5, depth: 0.05 })
    expect(deriveClayControls([]).position).toEqual({ x: 0.5, y: 0.5, depth: 0 })
  })

  it('maps hand span to a clamped scale', () => {
    expect(deriveClayControls([
      makeHand({ id: 'left', x: 0.2, y: 0.5 }),
      makeHand({ id: 'right', x: 0.88, y: 0.5 }),
    ]).scale).toBeCloseTo(2)
    expect(deriveClayControls([
      makeHand({ id: 'left', x: 0, y: 0.5 }),
      makeHand({ id: 'right', x: 0.99, y: 0.5 }),
    ]).scale).toBeCloseTo(2.8)
    expect(deriveClayControls([
      makeHand({ id: 'left', x: 0.49, y: 0.5 }),
      makeHand({ id: 'right', x: 0.51, y: 0.5 }),
    ]).scale).toBeCloseTo(0.45)
  })

  it('averages wrist roll with circular wraparound', () => {
    const controls = deriveClayControls([
      makeHand({ id: 'left', x: 0.3, y: 0.5, wristAngle: Math.PI - 0.08 }),
      makeHand({ id: 'right', x: 0.7, y: 0.5, wristAngle: -Math.PI + 0.08 }),
    ])

    expect(Math.abs(Math.abs(controls.rotation) - Math.PI)).toBeLessThan(0.01)
  })

  it('reports idle, stretch, and compress from pinch points', () => {
    const neutral = deriveClayControls([
      makeHand({ id: 'left', x: 0.3, y: 0.5 }),
      makeHand({ id: 'right', x: 0.7, y: 0.5 }),
    ])
    const onePinch = deriveClayControls([
      makeHand({ id: 'left', x: 0.3, y: 0.5, pinch: true }),
      makeHand({ id: 'right', x: 0.7, y: 0.5 }),
    ])
    const twoPinches = deriveClayControls([
      makeHand({ id: 'left', x: 0.3, y: 0.5, pinch: true }),
      makeHand({ id: 'right', x: 0.7, y: 0.5, pinch: true }),
    ])

    expect(neutral).toMatchObject({ deformation: 'idle', pinchPoints: [] })
    expect(onePinch).toMatchObject({ deformation: 'stretch', pinchPoints: [{ x: 0.3, y: 0.53 }] })
    expect(twoPinches.deformation).toBe('compress')
    expect(twoPinches.pinchPoints).toHaveLength(2)
  })

  it('creates a deterministic two-hand demo frame that cycles pinch states', () => {
    const neutral = createDemoFrame(0)
    const onePinch = createDemoFrame(1)
    const twoPinches = createDemoFrame(2)

    expect(neutral).toEqual(createDemoFrame(0))
    expect(neutral.hands).toHaveLength(2)
    expect(new Set(neutral.hands.map((hand) => hand.id)).size).toBe(2)
    expect(deriveClayControls(neutral.hands).deformation).toBe('idle')
    expect(deriveClayControls(onePinch.hands).deformation).toBe('stretch')
    expect(deriveClayControls(twoPinches.hands).deformation).toBe('compress')
  })
})
