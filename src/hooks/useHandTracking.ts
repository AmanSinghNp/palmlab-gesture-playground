import { useCallback, useEffect, useRef, useState } from 'react'
import { classifyGesture, countExtendedFingers, type NormalizedLandmark } from '../domain/gestures'
import type { GestureFrame } from '../domain/instrument'

export type CameraStatus = 'idle' | 'loading' | 'live' | 'denied' | 'error'

interface UseHandTrackingOptions {
  enabled: boolean
  onFrame: (frame: GestureFrame) => void
}

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export function useHandTracking({ enabled, onFrame }: UseHandTrackingOptions) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const landmarkerRef = useRef<import('@mediapipe/tasks-vision').HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const onFrameRef = useRef(onFrame)
  const previousCenters = useRef(new Map<number, { x: number; y: number; timestamp: number }>())
  const requestId = useRef(0)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    onFrameRef.current = onFrame
  }, [onFrame])

  const stop = useCallback(() => {
    requestId.current += 1
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    previousCenters.current.clear()
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs a secure browser context.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setError('')
    const currentRequest = ++requestId.current

    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (currentRequest !== requestId.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm',
      )
      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      }
      let landmarker: import('@mediapipe/tasks-vision').HandLandmarker
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, options)
      } catch {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        })
      }
      if (currentRequest !== requestId.current) {
        landmarker.close()
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      landmarkerRef.current = landmarker
      streamRef.current = stream
      if (!videoRef.current) throw new Error('Camera preview is not ready.')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      if (currentRequest !== requestId.current || !landmarkerRef.current) return
      setStatus('live')

      const detect = () => {
        const video = videoRef.current
        const activeLandmarker = landmarkerRef.current
        if (!video || !activeLandmarker || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(detect)
          return
        }

        const timestamp = performance.now()
        const result = activeLandmarker.detectForVideo(video, timestamp)
        const hands = result.landmarks.map((landmarks, index) => {
          const typedLandmarks = landmarks as NormalizedLandmark[]
          const center = typedLandmarks[9] ?? typedLandmarks[0]
          const previous = previousCenters.current.get(index)
          const elapsed = previous ? Math.max(16, timestamp - previous.timestamp) : 100
          const velocity = previous
            ? Math.min(1, Math.hypot(center.x - previous.x, center.y - previous.y) / (elapsed / 1000))
            : 0
          previousCenters.current.set(index, { x: center.x, y: center.y, timestamp })
          const handedness = result.handedness[index]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right'
          return {
            id: `${handedness.toLowerCase()}-${index}`,
            gesture: classifyGesture(typedLandmarks, handedness),
            fingerCount: countExtendedFingers(typedLandmarks, handedness),
            x: center.x,
            y: 1 - center.y,
            depth: center.z ?? 0,
            velocity,
            landmarks: typedLandmarks,
          }
        })

        onFrameRef.current({ hands, source: 'camera', timestamp })
        rafRef.current = requestAnimationFrame(detect)
      }
      rafRef.current = requestAnimationFrame(detect)
    } catch (cameraError) {
      if (currentRequest !== requestId.current) {
        stream?.getTracks().forEach((track) => track.stop())
        return
      }
      stream?.getTracks().forEach((track) => track.stop())
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      const message = cameraError instanceof DOMException && cameraError.name === 'NotAllowedError'
        ? 'Camera permission was not granted.'
        : 'Camera model unavailable. Demo mode is still ready.'
      setError(message)
      setStatus(cameraError instanceof DOMException && cameraError.name === 'NotAllowedError' ? 'denied' : 'error')
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }
    void start()
    return stop
  }, [enabled, start, stop])

  return { videoRef, status, error }
}
