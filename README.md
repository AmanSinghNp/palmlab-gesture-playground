# PalmLab — Gesture Playground

A private, browser-first creative-coding instrument for exploring hand gestures. PalmLab opens in a working simulated demo mode, so the stage is interactive before a camera is connected.

## What is inside

- **SCULPT** — pinch/grab moves a wireframe surface, wrist angle rolls it, and two tracked hands scale it.
- **DJ** — finger count and controls load cube, sphere, torus, or particle forms. Hand position maps to color, rotation, and distortion.
- **PHYSICS** — a live body field responds to grab/release cues, open-palm freeze, pointer burst, and keyboard fallback (`Space` / `E`).
- **Telemetry HUD** — hand count, finger count, depth, velocity, landmark map, gesture mapping, and camera/demo state.
- **Demo mode** — simulated hand signal is active on first load. No camera permission is requested until the camera control is selected.
- **Camera mode** — MediaPipe Tasks Vision Hand Landmarker runs in the browser when camera access and the model runtime are available.

## Local setup

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local Vite URL. The app is usable immediately in Demo mode.

### Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

## Camera and privacy

Camera mode is opt-in. The app requests camera permission only after selecting **USE CAMERA**. Hand landmarks are processed in the browser and are not uploaded, recorded, or stored by PalmLab. Switching back to Demo mode stops the media stream.

MediaPipe's WASM runtime and hand-landmarker model are loaded from their public CDNs when camera mode starts. If the runtime, model, browser, or permission is unavailable, the app keeps Demo mode available and explains the failure in the telemetry panel.

For camera mode, serve the app from `localhost` or another HTTPS origin. A production deployment should use HTTPS.

## Deploy to GitHub Pages

The repository includes two workflows:

- `.github/workflows/ci.yml` runs typecheck, tests, and a production build on pushes and pull requests.
- `.github/workflows/deploy-pages.yml` verifies and deploys `dist` to GitHub Pages on `main`.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The Vite base path is configured for this repository name in Actions builds.

## Project shape

```text
src/
  components/Stage.tsx       R3F / Three.js visual stage
  domain/gestures.ts         pure landmark and gesture helpers
  domain/instrument.ts       mode, material, shape, and frame contracts
  hooks/useHandTracking.ts   opt-in MediaPipe camera adapter
  App.tsx                    instrument layout and interaction routing
  App.css                    responsive dark instrument UI
```

PalmLab is intentionally private-ready: no analytics, no server, no auth surface, and no user media persistence.
