import { describe, expect, it } from 'vitest'
import { calculateTwoHandScale, calculateWristRotation, classifyGesture, countExtendedFingers, mapHandMotionToColor } from '../src/domain/gestures'

const landmark = (x: number, y: number) => ({ x, y, z: 0 })

function makeHand(extended: number, pinch = false) {
  const points = Array.from({ length: 21 }, () => landmark(0.5, 0.5))
  points[0] = landmark(0.5, 0.8)
  const fingers = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]
  fingers.forEach((finger, index) => {
    const isExtended = index < extended
    points[finger[0]] = landmark(0.42 + index * 0.07, 0.62)
    points[finger[1]] = landmark(0.42 + index * 0.07, isExtended ? 0.48 : 0.58)
    points[finger[2]] = landmark(0.42 + index * 0.07, isExtended ? 0.36 : 0.62)
    points[finger[3]] = landmark(0.42 + index * 0.07, isExtended ? 0.22 : 0.67)
  })
  points[1] = landmark(0.24, 0.68)
  points[2] = landmark(0.18, 0.58)
  points[3] = landmark(0.2, 0.48)
  points[4] = pinch ? landmark(0.4, 0.22) : extended === 4 ? landmark(0.08, 0.34) : landmark(0.3, 0.72)
  return points
}

describe('gesture domain helpers', () => {
  it('counts extended fingers from normalized landmarks', () => {
    expect(countExtendedFingers(makeHand(3))).toBe(3)
    expect(countExtendedFingers(makeHand(0))).toBe(0)
  })

  it('classifies a pinching hand before finger-count gestures', () => {
    expect(classifyGesture(makeHand(3, true))).toBe('pinch')
    expect(classifyGesture(makeHand(4))).toBe('open-palm')
    expect(classifyGesture(makeHand(0))).toBe('fist')
  })

  it('calculates a stable two-hand scale ratio', () => {
    expect(calculateTwoHandScale(0.5, 0.25)).toBe(2)
    expect(calculateTwoHandScale(0, 0.5)).toBe(1)
  })

  it('reads wrist rotation from the wrist-to-middle-finger vector', () => {
    const landmarks = Array.from({ length: 21 }, () => landmark(0.5, 0.5))
    landmarks[0] = landmark(0.5, 0.8)
    landmarks[9] = landmark(0.7, 0.5)
    expect(calculateWristRotation(landmarks)).toBeCloseTo(Math.atan2(-0.3, 0.2), 5)
  })

  it('maps normalized hand movement onto the instrument palette', () => {
    expect(mapHandMotionToColor(0, 0)).toEqual({ hue: 160, saturation: 78, lightness: 52 })
    expect(mapHandMotionToColor(1, 1)).toEqual({ hue: 320, saturation: 92, lightness: 62 })
  })
})
