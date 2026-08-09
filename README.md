# PalmLab — Clay Lab

A private, browser-first creative-coding instrument for shaping one clay sphere with two hands. PalmLab opens in a deterministic simulated demo, so the stage is interactive before a camera is connected.

## What is inside

- **Clay Lab** — hand midpoint controls position, hand span controls scale, and the circular mean of both wrist rolls controls rotation.
- **Pinch deformation** — one pinch stretches the clay toward that hand; two pinches compress the form between both points; release relaxes it back to round.
- **Pair telemetry** — hand count, pinch count, span, scale, midpoint, wrist roll, and a live landmark map.
- **Demo mode** — two distinct simulated hands cycle through neutral, one pinch, and two pinches without requesting camera permission.
- **Camera mode** — MediaPipe Tasks Vision Hand Landmarker tracks up to two hands in the browser when camera access and the model runtime are available.

## Local setup

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the local Vite URL. The app is usable immediately in Demo mode.

### Verification commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Camera and privacy

Camera mode is opt-in. The app requests camera permission only after selecting **USE CAMERA**. Hand landmarks are processed in the browser and are not uploaded, recorded, or stored by PalmLab. Switching back to Demo mode stops the media stream.

MediaPipe's WASM runtime and hand-landmarker model are loaded from their public CDNs when camera mode starts. If the runtime, model, browser, or permission is unavailable, Demo mode remains available and the telemetry panel explains the failure.

For camera mode, serve the app from `localhost` or another HTTPS origin. A production deployment should use HTTPS.

## Deploy to GitHub Pages

The repository includes two workflows:

- `.github/workflows/ci.yml` runs typecheck, tests, and a production build on pushes and pull requests.
- `.github/workflows/deploy-pages.yml` verifies and deploys `dist` to GitHub Pages on `main`.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The Vite base path is configured for this repository name in Actions builds.

## Project shape

```text
src/
  components/Stage.tsx       R3F / Three.js deformable clay sphere
  domain/clay.ts             pure clay controls and deterministic demo frame
  domain/gestures.ts         pure landmark and gesture helpers
  domain/instrument.ts       hand-tracking and frame contracts
  hooks/useHandTracking.ts   opt-in MediaPipe camera adapter
  App.tsx                    single Clay Lab layout and telemetry
  App.css                    responsive dark instrument UI
```

PalmLab is intentionally private-ready: no analytics, no server, no auth surface, and no user media persistence.
