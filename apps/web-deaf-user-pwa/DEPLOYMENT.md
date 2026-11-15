# Signova Deaf-user PWA — Deployment Guide

## Overview

The Signova Deaf-user application is now an installable Progressive Web Application (PWA) built with React 19, TypeScript, and Vite. It runs entirely in the browser with on-device ASL recognition via LiteRT.js and MediaPipe Tasks Vision.

## Build

```bash
# From the PWA workspace directory
cd apps/web-deaf-user-pwa

# Install dependencies
npm install

# Typecheck + production build
npm run build

# Preview production build locally
npm run preview
```

Build output goes to `apps/web-deaf-user-pwa/dist/`. Serve it over HTTPS with any static host (Netlify, Vercel, Firebase Hosting, S3+CloudFront, etc.).

## Required environment variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend base URL (no trailing slash) | `https://api.signova.example.com` |
| `VITE_USE_MODEL` | Enable real TFLite on-device recognition | `true` (default mock if unset) |

Set these at build time (Vite inlines `import.meta.env.*`). Do NOT commit real `.env` files.

## Backend deployment requirements

The PWA reuses the existing Node.js/Express/MongoDB/Socket.IO backend at `server/`. Do not modify it.

- **Port:** 4000 (configurable via server/.env)
- **Namespace:** `/signova` Socket.IO namespace
- **Auth:** JWT Bearer tokens (device-scoped sessions for Deaf users)
- **Endpoints used:** `GET /api/kiosk/organization`, `GET /api/kiosk/tellers`, `POST /api/kiosk/sessions`, `GET|POST /api/sessions/:id/messages`, `POST /api/sessions/:id/translate`, `PATCH /api/sessions/:id/status`

## CORS configuration

The backend must allow the PWA origin. In `server/.env`:

```
CORS_ORIGINS=https://your-pwa-domain.example.com,http://localhost:5175
```

For development on the same machine, `http://localhost:5175` is the Vite dev server. On a physical Android phone, `localhost` refers to the phone itself — use the server's LAN IP instead.

## Socket.IO production configuration

- Use WebSocket transport with polling fallback
- Configure `allowedOrigins` on the Socket.IO server to match the PWA domain
- Behind a reverse proxy (nginx, etc.), enable WebSocket proxying:
  ```
  location /socket.io/ {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
  ```

## Model asset hosting/bundling strategy

The following assets are bundled and precached by the PWA service worker:

| Asset | Path | Size |
|---|---|---|
| TFLite model | `/model/signova_model.tflite` | ~1.3 MB |
| Label map | `/model/labels.json` | ~13 KB |
| Model info | `/model/model_info.json` | small |
| MediaPipe wasm | `/wasm-vision/vision_wasm_*.wasm` | ~14.7 MB each |
| LiteRT wasm | `/wasm/litert_wasm_*.wasm` | ~10-13 MB each |
| Hand landmarker task model | `/models/hand_landmarker.task` | ~7.8 MB |

Total precache: ~79 MB. All are served from the PWA origin and cached for offline use.

## HTTPS requirements

PWA installation requires HTTPS (except localhost). Deploy behind HTTPS with a valid certificate. The service worker will not register over plain HTTP on non-localhost origins.

## PWA installation instructions

### Chrome on Android

1. Open the PWA URL in Chrome
2. Chrome shows an "Install Signova" prompt (beforeinstallprompt)
3. User taps Install → app appears on home screen
4. App launches in standalone mode (no browser chrome)

### Manual install

Chrome menu → "Add to Home screen" or "Install app"

## Offline behaviour

- **Sign recognition:** Works fully offline (model + MediaPipe wasm cached)
- **Messaging:** Requires internet connection (backend API + Socket.IO)
- **App shell:** Cached by service worker; loads offline

## Camera permission

- On first sign attempt, the PWA requests camera access via `navigator.mediaDevices.getUserMedia()`
- If denied, show the CameraPermission screen guiding the user to browser site settings
- No video leaves the device — all processing is on-device

## File inventory (new PWA workspace)

```
apps/web-deaf-user-pwa/
├── package.json          # Vite + React + LiteRT + MediaPipe + PWA plugin
├── tsconfig.json
├── vite.config.ts        # Vite + vite-plugin-pwa config
├── index.html            # HTML entry with theme-color meta
├── vite-env.d.ts         # Vite env types
├── public/
│   ├── model/            # signova_model.tflite, labels.json, model_info.json
│   ├── models/           # hand_landmarker.task (MediaPipe)
│   ├── icons/            # PWA icons (16-512px)
│   ├── assets/           # brand images
│   └── wasm, wasm-vision/# LiteRT + MediaPipe WASM binaries
└── src/
    ├── App.tsx           # Root navigator (18-step state machine)
    ├── main.tsx          # ReactDOM entry
    ├── index.css         # Design tokens (Royal Purple / Cornsilk)
    ├── config.ts         # VITE_API_URL, VITE_USE_MODEL
    ├── vite-env.d.ts
    ├── context/SessionContext.tsx   # 18-step state machine + socket + recognition
    ├── model/recogniser.ts          # LiteRT.js TFLite inference
    ├── model/preprocess.ts          # (reused) landmark → Float32[60][126]
    ├── model/mediapipe-adapter.ts   # (reused) MediaPipe → FrameLandmarks
    ├── hooks/useViewport.ts         # window size hook
    ├── hooks/useHandRecorder.ts     # (reused) 60-frame ring buffer
    ├── hooks/useHandLandmarker.ts   # MediaPipe Tasks Vision VIDEO mode
    ├── services/api.ts              # fetch client (existing endpoints)
    ├── services/socket.ts           # Socket.IO client (/signova)
    ├── services/translation.ts      # translation seam
    ├── services/deviceId.ts         # localStorage device identity
    ├── components/ui/TouchButton.tsx# RN TouchButton → button port
    ├── styles/mergeStyles.ts        # style array → object merge
    └── screens/                     # 20 screens ported from React Native
```

## Verification checklist

- [x] TypeScript compilation: `tsc --noEmit` passes
- [x] Production build: `vite build` succeeds
- [x] PWA manifest: generated with Signova branding, standalone display
- [x] Service worker: generated with 38 precached entries (~79 MB)
- [x] LiteRT.js model loading: verified in Chromium (33ms inference)
- [x] Model input/output contract: `landmark_sequence[1,60,126]float32` → `output_0[1,2000]float32`
- [x] Softmax check: output sums to 1.0 (softmax already applied in graph)
- [ ] Real-device camera test on Android Chrome (no physical device available)
- [ ] End-to-end Deaf-user/staff Socket.IO communication test
- [ ] Backend tests (pre-existing failures unrelated to PWA)

## Notes

- Backend test failures (19 tests) are pre-existing syntax errors in test files, not caused by the PWA migration.
- A physical Android device is required for real-device camera/MediaPipe verification.
- The existing React Native app, staff dashboard, admin dashboard, and backend are all preserved unchanged.