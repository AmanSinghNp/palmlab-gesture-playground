import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calculateTwoHandScale, calculateWristRotation, mapHandMotionToColor, type GestureName } from './domain/gestures'
import { DJ_SHAPES, MATERIALS, MODES, type DjShape, type GestureFrame, type MaterialPreset, type Mode, type TrackedHand } from './domain/instrument'
import { useHandTracking } from './hooks/useHandTracking'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import { Stage } from './components/Stage'
import './App.css'

const modeOrder: Mode[] = ['SCULPT', 'DJ', 'PHYSICS']
const demoGestures: GestureName[] = ['pinch', 'neutral', 'open-palm', 'fist', 'point']
const fingerCountByGesture: Record<GestureName, number> = {
  pinch: 2,
  neutral: 2,
  'open-palm': 5,
  fist: 0,
  point: 1,
}

function makeDemoLandmarks(x: number, y: number) {
  return Array.from({ length: 21 }, (_, index) => ({
    x: Math.min(0.95, Math.max(0.05, x + Math.sin(index * 1.7) * 0.07)),
    y: Math.min(0.95, Math.max(0.05, 1 - y + Math.cos(index * 1.1) * 0.08)),
    z: 0,
  }))
}

function useDemoFrame(mode: Mode) {
  const [tick, setTick] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 160)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return useMemo<GestureFrame>(() => {
    const x = 0.5 + Math.sin(tick * 0.07) * 0.28
    const y = 0.55 + Math.cos(tick * 0.055) * 0.2
    const modeOffset = mode === 'SCULPT' ? 0 : mode === 'DJ' ? 1 : 2
    const gesture = demoGestures[(Math.floor(tick / 16) + modeOffset) % demoGestures.length]
    const hand: TrackedHand = {
      id: 'demo-hand-01',
      gesture,
      fingerCount: fingerCountByGesture[gesture],
      x,
      y,
      depth: Math.sin(tick * 0.04) * 0.14,
      velocity: 0.22 + Math.abs(Math.cos(tick * 0.07)) * 0.45,
      landmarks: makeDemoLandmarks(x, y),
    }
    return { hands: [hand], source: 'demo', timestamp: Date.now() }
  }, [mode, tick])
}

function App() {
  const [mode, setMode] = useState<Mode>('SCULPT')
  const [material, setMaterial] = useState<MaterialPreset>('chrome')
  const [djShape, setDjShape] = useState<DjShape>('sphere')
  const [inputSource, setInputSource] = useState<'demo' | 'camera'>('demo')
  const [cameraFrame, setCameraFrame] = useState<GestureFrame>({ hands: [], source: 'camera', timestamp: 0 })
  const [frozen, setFrozen] = useState(false)
  const [cue, setCue] = useState('Demo signal running')
  const [cuePulse, setCuePulse] = useState(0)
  const cueTimeout = useRef<number | null>(null)
  const lastSwipe = useRef(0)
  const demoFrame = useDemoFrame(mode)
  const onCameraFrame = useCallback((frame: GestureFrame) => setCameraFrame(frame), [])
  const { videoRef, status: cameraStatus, error: cameraError } = useHandTracking({
    enabled: inputSource === 'camera',
    onFrame: onCameraFrame,
  })
  const activeFrame = inputSource === 'camera' ? cameraFrame : demoFrame
  const primaryHand = activeFrame.hands[0]
  const primaryGesture = primaryHand?.gesture
  const fallbackHand = demoFrame.hands[0]
  const handForStage: TrackedHand = primaryHand ?? (inputSource === 'demo' ? fallbackHand : {
    id: 'idle-hand',
    gesture: 'neutral',
    fingerCount: 0,
    x: 0.5,
    y: 0.5,
    depth: 0,
    velocity: 0,
    landmarks: [],
  })
  const primaryFingerCount = primaryHand?.fingerCount ?? null
  const modeInfo = MODES[mode]
  const motionColor = mapHandMotionToColor(handForStage.x, handForStage.y)
  const handScale = useMemo(() => {
    if (mode !== 'SCULPT' || activeFrame.hands.length < 2) return 1
    const first = activeFrame.hands[0]
    const second = activeFrame.hands[1]
    return calculateTwoHandScale(Math.hypot(first.x - second.x, first.y - second.y), 0.34)
  }, [activeFrame.hands, mode])
  const wristRotation = calculateWristRotation(handForStage.landmarks)

  const showCue = useCallback((message: string, pulse = false) => {
    setCue(message)
    if (pulse) setCuePulse(Date.now())
    if (cueTimeout.current !== null) window.clearTimeout(cueTimeout.current)
    cueTimeout.current = window.setTimeout(() => setCue(mode === 'PHYSICS' ? 'Field is listening' : 'Demo signal running'), 1400)
  }, [mode])

  useEffect(() => {
    return () => {
      if (cueTimeout.current !== null) window.clearTimeout(cueTimeout.current)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'DJ' || !primaryHand || primaryHand.velocity < 0.5) return
    const now = Date.now()
    if (now - lastSwipe.current < 700) return
    lastSwipe.current = now
    const direction = primaryHand.x > 0.5 ? 1 : -1
    setDjShape((current) => {
      const index = DJ_SHAPES.findIndex((shape) => shape.id === current)
      return DJ_SHAPES[(index + direction + DJ_SHAPES.length) % DJ_SHAPES.length].id
    })
    showCue(direction > 0 ? 'Swipe right / next form' : 'Swipe left / previous form')
  }, [mode, primaryHand, showCue])

  useEffect(() => {
    if (mode !== 'DJ' || primaryFingerCount === null || primaryFingerCount < 1 || primaryFingerCount > DJ_SHAPES.length) return
    const nextShape = DJ_SHAPES[primaryFingerCount - 1].id
    if (nextShape === djShape) return
    setDjShape(nextShape)
    showCue(`${DJ_SHAPES[primaryFingerCount - 1].label} / finger select`)
  }, [djShape, mode, primaryFingerCount, showCue])
  useEffect(() => {
    if (mode !== 'PHYSICS' || !primaryGesture) return
    if (primaryGesture === 'open-palm') {
      setFrozen(true)
      showCue('Open palm / freeze field')
    }
    if (primaryGesture === 'fist') {
      setFrozen(false)
      showCue('Fist / release gravity')
    }
  }, [mode, primaryGesture, showCue])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (mode !== 'PHYSICS') return
      if (event.code === 'Space') {
        event.preventDefault()
        setFrozen((value) => !value)
        showCue(frozen ? 'Space / release gravity' : 'Space / freeze field')
      }
      if (event.code === 'KeyE') {
        showCue('E / particle burst', true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [frozen, mode, showCue])

  const handleStagePointer = () => {
    if (mode === 'PHYSICS') showCue('Pointer / particle burst', true)
    if (mode === 'SCULPT') showCue('Stage / surface selected')
    if (mode === 'DJ') showCue('Stage / signal sampled')
  }

  const handleStageKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handleStagePointer()
  }

  const handleSource = (source: 'demo' | 'camera') => {
    setInputSource(source)
    if (source === 'demo') {
      setCameraFrame({ hands: [], source: 'camera', timestamp: 0 })
      showCue('Demo signal running')
    } else {
      showCue('Connecting to camera…')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="PalmLab home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="brand-word">PALMLAB</span>
          <span className="brand-subtitle">Gesture Playground</span>
        </a>
        <nav className="mode-nav" aria-label="Instrument modes">
          {modeOrder.map((item) => (
            <button key={item} type="button" className={mode === item ? 'mode-nav-button active' : 'mode-nav-button'} onClick={() => setMode(item)} aria-pressed={mode === item}>
              {item}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <span className="build-label"><span className="status-dot" /> v0.4 / LOCAL</span>
          <button type="button" className="camera-button" onClick={() => handleSource(inputSource === 'camera' ? 'demo' : 'camera')} aria-pressed={inputSource === 'camera'}>
            <span aria-hidden="true">◎</span> {inputSource === 'camera' ? 'CAMERA ON' : 'USE CAMERA'}
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="control-rail" aria-label="Instrument controls">
          <div className="rail-intro">
            <span className="micro-label">PALMLAB / 01</span>
            <h1>{modeInfo.title}</h1>
            <p>{modeInfo.description}</p>
          </div>

          <div className="control-section">
            <div className="section-label"><span>01</span> MODE</div>
            <div className="mode-list">
              {modeOrder.map((item, index) => (
                <button key={item} type="button" className={mode === item ? 'mode-row active' : 'mode-row'} onClick={() => setMode(item)} aria-pressed={mode === item}>
                  <span className="mode-index">0{index + 1}</span>
                  <span>{item}</span>
                  <span className="mode-arrow" aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'SCULPT' && (
            <div className="control-section">
              <div className="section-label"><span>02</span> MATERIAL</div>
              <div className="preset-grid">
                {MATERIALS.map((preset) => (
                  <button key={preset.id} type="button" className={material === preset.id ? 'preset active' : 'preset'} onClick={() => setMaterial(preset.id)} aria-pressed={material === preset.id}>
                    <span className="swatch" style={{ backgroundColor: preset.swatch }} />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'DJ' && (
            <div className="control-section">
              <div className="section-label"><span>02</span> INSTRUMENT</div>
              <div className="shape-list">
                {DJ_SHAPES.map((shape) => (
                  <button key={shape.id} type="button" className={djShape === shape.id ? 'shape-row active' : 'shape-row'} onClick={() => { setDjShape(shape.id); showCue(`${shape.label} / loaded`) }} aria-pressed={djShape === shape.id}>
                    <span className="shape-key">{shape.key}</span>
                    <span>{shape.label}</span>
                    <span className="shape-glyph" aria-hidden="true">{shape.id === 'particles' ? '•••' : shape.id === 'torus' ? '◌' : shape.id === 'sphere' ? '○' : '□'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'PHYSICS' && (
            <div className="control-section">
              <div className="section-label"><span>02</span> FIELD CONTROL</div>
              <button type="button" className={frozen ? 'field-toggle active' : 'field-toggle'} onClick={() => { setFrozen((value) => !value); showCue(frozen ? 'Field released' : 'Field frozen') }} aria-pressed={frozen}>
                <span className="toggle-glyph" aria-hidden="true">{frozen ? 'Ⅱ' : '▶'}</span>
                {frozen ? 'Release gravity' : 'Freeze field'}
                <span className="shortcut">SPACE</span>
              </button>
              <button type="button" className="field-toggle" onClick={() => showCue('Particle burst', true)}>
                <span className="toggle-glyph" aria-hidden="true">✳</span>
                Trigger burst
                <span className="shortcut">E</span>
              </button>
            </div>
          )}

          <div className="rail-footnote">
            <span className="tiny-line" />
            <p>Every signal stays in your browser. No hand footage is recorded.</p>
          </div>
        </aside>

        <section className="stage-column" aria-label={`${mode} visual stage`}>
          <div className="stage-toolbar">
            <div className="stage-title"><span className="live-mark" /> LIVE STAGE <span className="slash">/</span> {mode}</div>
            <div className="stage-toolbar-meta"><span>60 FPS TARGET</span><span className="toolbar-divider" /><span>{activeFrame.hands.length ? `${activeFrame.hands.length} HAND${activeFrame.hands.length > 1 ? 'S' : ''}` : 'SEARCHING'}</span></div>
          </div>
          <div className="stage-shell" onClick={handleStagePointer} onKeyDown={handleStageKeyDown} role="button" tabIndex={0} aria-label="Activate the 3D stage">
            <div className="stage-canvas"><Stage mode={mode} material={material} djShape={djShape} handPosition={{ x: handForStage.x, y: handForStage.y, depth: handForStage.depth, rotation: wristRotation, velocity: handForStage.velocity }} handScale={handScale} gesture={handForStage.gesture} frozen={frozen} cuePulse={cuePulse} /></div>
            <div className="stage-crosshair crosshair-top" aria-hidden="true" />
            <div className="stage-crosshair crosshair-bottom" aria-hidden="true" />
            <div className="stage-corner stage-corner-tl" aria-hidden="true" />
            <div className="stage-corner stage-corner-tr" aria-hidden="true" />
            <div className="stage-corner stage-corner-bl" aria-hidden="true" />
            <div className="stage-corner stage-corner-br" aria-hidden="true" />
            <div className="stage-overlay stage-overlay-top"><span>ORIGIN / 000</span><span>AXIS Y ↕</span></div>
            <div className="stage-overlay stage-overlay-bottom"><span className="cue-text" role="status" aria-live="polite">{cue}</span><span>{mode === 'PHYSICS' && frozen ? 'FIELD PAUSED' : 'INTERACTION READY'}</span></div>
            {inputSource === 'camera' && <div className={`camera-preview ${cameraStatus}`}><video ref={videoRef} muted autoPlay playsInline aria-label="Camera preview" /><span>{cameraStatus === 'live' ? 'LIVE INPUT' : cameraStatus === 'loading' ? 'LOADING TRACKER' : 'CAMERA'}</span></div>}
          </div>
          <div className="stage-caption"><span>{modeInfo.action}</span><span>{modeInfo.hint}</span><span className="caption-action">Click stage to interact <b>↗</b></span></div>
        </section>

        <aside className="signal-panel" aria-label="Hand signal telemetry">
          <div className="signal-heading"><span className="micro-label">TELEMETRY</span><span className={inputSource === 'camera' && cameraStatus === 'live' ? 'connection live' : 'connection'}><span className="status-dot" /> {inputSource === 'camera' ? cameraStatus.toUpperCase() : 'SIMULATED'}</span></div>
          <div className="signal-hero">
            <span className="micro-label">ACTIVE GESTURE</span>
            <strong>{primaryHand?.gesture?.replace('-', ' ') ?? (inputSource === 'camera' ? 'no hand' : 'searching')}</strong>
            <div className="signal-subline"><span>{inputSource === 'camera' ? 'MediaPipe tracker' : 'Demo hand / 01'}</span><span>{primaryHand ? `${primaryHand.fingerCount} fingers` : 'Awaiting signal'}</span></div>
          </div>

          <div className="landmark-map" aria-label="Hand landmark map">
            {primaryHand ? primaryHand.landmarks.map((landmark, index) => <span key={index} className="landmark" style={{ left: `${landmark.x * 100}%`, top: `${landmark.y * 100}%` }} />) : <span className="landmark-empty">Place a hand in frame</span>}
            <span className="map-axis map-axis-x" /><span className="map-axis map-axis-y" />
            <span className="map-label map-label-tl">X 000</span><span className="map-label map-label-br">Y 000</span>
          </div>

          <div className="telemetry-grid">
            <div><span className="metric-label">HANDS</span><strong>{activeFrame.hands.length.toString().padStart(2, '0')}</strong></div>
            <div><span className="metric-label">FINGERS</span><strong>{(primaryHand?.fingerCount ?? 0).toString().padStart(2, '0')}</strong></div>
            <div><span className="metric-label">DEPTH</span><strong>{primaryHand ? `${Math.abs(primaryHand.depth).toFixed(2)}` : '—'}</strong></div>
            <div><span className="metric-label">VELOCITY</span><strong>{primaryHand ? `${Math.round(primaryHand.velocity * 100)}%` : '—'}</strong></div>
          </div>

          <div className="signal-section">
            <div className="section-label"><span>03</span> MOTION VECTOR</div>
            <div className="meter-row"><span>X / LATERAL</span><span>{Math.round(handForStage.x * 100)}%</span><i><b style={{ width: `${handForStage.x * 100}%` }} /></i></div>
            <div className="meter-row"><span>Y / VERTICAL</span><span>{Math.round(handForStage.y * 100)}%</span><i><b style={{ width: `${handForStage.y * 100}%` }} /></i></div>
            <div className="meter-row"><span>HUE / SIGNAL</span><span>{motionColor.hue}°</span><i><b className="hue-meter" style={{ width: `${Math.max(10, handForStage.x * 100)}%` }} /></i></div>
          </div>

          <div className="signal-section mapping-section">
            <div className="section-label"><span>04</span> GESTURE MAP</div>
            <div className="mapping-row"><span className="gesture-icon">●</span><span>Pinch</span><b>SCULPT / GRAB</b></div>
            <div className="mapping-row"><span className="gesture-icon">✣</span><span>Open palm</span><b>PHYSICS / FREEZE</b></div>
            <div className="mapping-row"><span className="gesture-icon">—</span><span>Swipe</span><b>DJ / CHANGE</b></div>
          </div>

          {cameraError && <p className="camera-error" role="status">{cameraError}</p>}
        </aside>
      </main>

      <footer className="statusbar"><span><b className="footer-signal" /> SIGNAL ROUTER ONLINE</span><span>DEMO MODE IS ACTIVE BY DEFAULT</span><span className="footer-right">PRIVACY FIRST <span className="footer-divider" /> PALMLAB.LAB</span></footer>
    </div>
  )
}

export default App
