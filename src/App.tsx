import { useCallback, useEffect, useMemo, useState } from 'react'
import { createDemoFrame, deriveClayControls } from './domain/clay'
import type { GestureFrame } from './domain/instrument'
import { Stage } from './components/Stage'
import { useHandTracking } from './hooks/useHandTracking'
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion'
import './App.css'

function useDemoFrame() {
  const [tick, setTick] = useState(0)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 160)
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  return useMemo(() => createDemoFrame(tick), [tick])
}

function formatDegrees(radians: number) {
  return `${Math.round((radians * 180) / Math.PI)}°`
}

function App() {
  const [inputSource, setInputSource] = useState<'demo' | 'camera'>('demo')
  const [cameraFrame, setCameraFrame] = useState<GestureFrame>({ hands: [], source: 'camera', timestamp: 0 })
  const demoFrame = useDemoFrame()
  const onCameraFrame = useCallback((frame: GestureFrame) => setCameraFrame(frame), [])
  const { videoRef, status: cameraStatus, error: cameraError } = useHandTracking({
    enabled: inputSource === 'camera',
    onFrame: onCameraFrame,
  })
  const activeFrame = inputSource === 'camera' ? cameraFrame : demoFrame
  const controls = useMemo(() => deriveClayControls(activeFrame.hands), [activeFrame.hands])
  const pinchCount = controls.pinchPoints.length
  const handSpan = activeFrame.hands.length === 2 ? controls.span : null
  const connectionLabel = inputSource === 'camera' ? cameraStatus.toUpperCase() : 'SIMULATED'
  const cameraLabel = inputSource === 'camera'
    ? cameraStatus === 'loading' ? 'LOADING…' : cameraStatus === 'live' ? 'CAMERA ON' : 'RETRY CAMERA'
    : 'USE CAMERA'
  const stageCue = cameraError
    ? cameraError
    : inputSource === 'camera'
      ? cameraStatus === 'live' ? 'Camera signal running' : 'Connecting to camera…'
      : controls.deformation === 'idle' ? 'Release to relax' : `${controls.deformation} signal received`

  const handleSource = (source: 'demo' | 'camera') => {
    setInputSource(source)
    if (source === 'demo') setCameraFrame({ hands: [], source: 'camera', timestamp: 0 })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="PalmLab home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="brand-word">PALMLAB</span>
          <span className="brand-subtitle">Gesture Playground</span>
        </a>
        <div className="topbar-context"><span className="status-dot" /> CLAY LAB / TWO-HAND STUDY</div>
        <div className="topbar-actions">
          <span className="build-label"><span className="status-dot" /> v0.5 / LOCAL</span>
          <button type="button" className="camera-button" onClick={() => handleSource(inputSource === 'camera' ? 'demo' : 'camera')} aria-pressed={inputSource === 'camera'}>
            <span aria-hidden="true">◎</span> {cameraLabel}
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="control-rail" aria-label="Clay Lab instructions">
          <div className="rail-intro">
            <span className="micro-label">PALMLAB / 01</span>
            <h1>Clay Lab</h1>
            <p>One soft form. Two hands. Shape it in real time.</p>
          </div>

          <div className="control-section">
            <div className="section-label"><span>01</span> GESTURE SCORE</div>
            <div className="instruction-list">
              <div className="instruction-row">
                <span className="instruction-key">01</span>
                <span><b>One pinch</b><small>Stretch toward the pinched hand</small></span>
              </div>
              <div className="instruction-row">
                <span className="instruction-key">02</span>
                <span><b>Two pinches</b><small>Compress between both points</small></span>
              </div>
              <div className="instruction-row">
                <span className="instruction-key">03</span>
                <span><b>Release</b><small>Let the clay relax back to round</small></span>
              </div>
            </div>
          </div>

          <div className="control-section rail-reference">
            <div className="section-label"><span>02</span> HAND PAIR</div>
            <p>Bring both wrists into frame to set the clay's center, span, and roll.</p>
          </div>

          <div className="rail-footnote">
            <span className="tiny-line" />
            <p>Every signal stays in your browser. No hand footage is recorded.</p>
          </div>
        </aside>

        <section className="stage-column" aria-label="Clay Lab visual stage">
          <div className="stage-toolbar">
            <div className="stage-title"><span className="live-mark" /> LIVE STAGE <span className="slash">/</span> CLAY LAB</div>
            <div className="stage-toolbar-meta"><span>60 FPS TARGET</span><span className="toolbar-divider" /><span>{activeFrame.hands.length ? `${activeFrame.hands.length} HANDS` : 'SEARCHING'}</span></div>
          </div>
          <div className="stage-shell">
            <div className="stage-canvas"><Stage controls={controls} /></div>
            <div className="stage-crosshair crosshair-top" aria-hidden="true" />
            <div className="stage-crosshair crosshair-bottom" aria-hidden="true" />
            <div className="stage-corner stage-corner-tl" aria-hidden="true" />
            <div className="stage-corner stage-corner-tr" aria-hidden="true" />
            <div className="stage-corner stage-corner-bl" aria-hidden="true" />
            <div className="stage-corner stage-corner-br" aria-hidden="true" />
            <div className="stage-overlay stage-overlay-top"><span>ORIGIN / MIDPOINT</span><span>ROLL {formatDegrees(controls.rotation)}</span></div>
            <div className="stage-overlay stage-overlay-bottom"><span className="cue-text" role="status" aria-live="polite">{stageCue}</span><span>{controls.deformation.toUpperCase()}</span></div>
            {inputSource === 'camera' && <div className={`camera-preview ${cameraStatus}`}><video ref={videoRef} muted autoPlay playsInline aria-label="Camera preview" /><span>{cameraStatus === 'live' ? 'LIVE INPUT' : cameraStatus === 'loading' ? 'LOADING TRACKER' : 'CAMERA'}</span></div>}
          </div>
          <div className="stage-caption"><span>MIDPOINT / POSITION</span><span>SPAN / SCALE</span><span>PINCH / DEFORM</span></div>
        </section>

        <aside className="signal-panel" aria-label="Two-hand telemetry">
          <div className="signal-heading"><span className="micro-label">PAIR TELEMETRY</span><span className={inputSource === 'camera' && cameraStatus === 'live' ? 'connection live' : 'connection'}><span className="status-dot" /> {connectionLabel}</span></div>
          <div className="signal-hero">
            <span className="micro-label">CLAY STATE</span>
            <strong>{controls.deformation}</strong>
            <div className="signal-subline"><span>{inputSource === 'camera' ? 'MediaPipe / two hands' : 'Demo pair / 01—02'}</span><span>{pinchCount} pinch{pinchCount === 1 ? '' : 'es'}</span></div>
          </div>

          <div className="landmark-map" aria-label="Tracked hand landmark map">
            {activeFrame.hands.map((hand, handIndex) => hand.landmarks.map((landmark, index) => <span key={`${hand.id}-${index}`} className={`landmark landmark-hand-${handIndex + 1}`} style={{ left: `${landmark.x * 100}%`, top: `${landmark.y * 100}%` }} />))}
            {activeFrame.hands.length === 0 && <span className="landmark-empty">Place both hands in frame</span>}
            <span className="map-axis map-axis-x" /><span className="map-axis map-axis-y" />
            <span className="map-label map-label-tl">PAIR / 02</span><span className="map-label map-label-br">LANDMARKS</span>
          </div>

          <div className="telemetry-grid">
            <div><span className="metric-label">HANDS</span><strong>{activeFrame.hands.length.toString().padStart(2, '0')}</strong></div>
            <div><span className="metric-label">PINCHES</span><strong>{pinchCount.toString().padStart(2, '0')}</strong></div>
            <div><span className="metric-label">SPAN</span><strong>{handSpan === null ? '—' : handSpan.toFixed(2)}</strong></div>
            <div><span className="metric-label">SCALE</span><strong>{controls.scale.toFixed(2)}</strong></div>
          </div>

          <div className="signal-section">
            <div className="section-label"><span>03</span> CLAY VECTOR</div>
            <div className="meter-row"><span>MIDPOINT / X</span><span>{Math.round(controls.position.x * 100)}%</span><i><b style={{ width: `${controls.position.x * 100}%` }} /></i></div>
            <div className="meter-row"><span>MIDPOINT / Y</span><span>{Math.round(controls.position.y * 100)}%</span><i><b style={{ width: `${controls.position.y * 100}%` }} /></i></div>
            <div className="meter-row"><span>WRIST / ROLL</span><span>{formatDegrees(controls.rotation)}</span><i><b style={{ width: `${((controls.rotation + Math.PI) / (Math.PI * 2)) * 100}%` }} /></i></div>
          </div>

          <div className="signal-section mapping-section">
            <div className="section-label"><span>04</span> GESTURE MAP</div>
            <div className="mapping-row"><span className="gesture-icon">●</span><span>One pinch</span><b>STRETCH</b></div>
            <div className="mapping-row"><span className="gesture-icon">●●</span><span>Two pinches</span><b>COMPRESS</b></div>
            <div className="mapping-row"><span className="gesture-icon">—</span><span>Release</span><b>RELAX</b></div>
          </div>

          {cameraError && <p className="camera-error" role="status">{cameraError}</p>}
        </aside>
      </main>

      <footer className="statusbar"><span><b className="footer-signal" /> SIGNAL ROUTER ONLINE</span><span>PAIR TRACKING / TWO HANDS</span><span className="footer-right">PRIVACY FIRST <span className="footer-divider" /> PALMLAB.LAB</span></footer>
    </div>
  )
}

export default App
