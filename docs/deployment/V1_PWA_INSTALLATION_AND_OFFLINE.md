# Signova V1 — PWA Installation and Offline Readiness

**Application:** `apps/web-deaf-user-pwa`  
**Production address:** `https://app.<SIGNOVA_DOMAIN>`  
**Status:** application shell, manifest, service worker, model/label/task
precaching, and offline reload verified in headless Chromium on the local
production build. Android installation and camera remain **not tested** because
no physical device was available.

---

## 1. Manifest

Generated at `dist/manifest.webmanifest` by `vite-plugin-pwa`.

| Field | Value |
|---|---|
| `name` | `Signova` |
| `short_name` | `Signova` |
| `description` | “ASL to text translation for Deaf and hard-of-hearing service users.” |
| `id` | `/` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `theme_color` | `#5B2A86` |
| `background_color` | `#FFF8DC` |
| `lang` | `en` |

Icons:

| File | Size | Purpose |
|---|---|---|
| `/icons/android-chrome-192x192.png` | 192×192 | `any maskable` |
| `/icons/android-chrome-512x512.png` | 512×512 | any |
| `/icons/apple-touch-icon.png` | 180×180 | iOS |
| `/icons/favicon-32x32.png` | 32×32 | browser |
| `/icons/favicon-16x16.png` | 16×16 | browser |

Chromium reported **0 manifest errors** and **0 installability errors** for the
production build.

`orientation: "portrait"` is intentional for the phone kiosk flow. On tablets the
app still renders responsively, but a landscape lock is not configured. If the
owner wants landscape tablets, test a manifest change separately; it is not part
of this deployment.

---

## 2. Service worker and caching

Registration is injected by `vite-plugin-pwa` (`registerSW.js`) and uses
`registerType: "autoUpdate"`. It is not manually imported in `main.tsx`.

Workbox configuration in `apps/web-deaf-user-pwa/vite.config.ts`:

```ts
globPatterns: [
  "**/*.{js,css,html,ico,png,svg,tflite,task,json,wasm,woff2,webmanifest}",
],
maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
cleanupOutdatedCaches: true,
```

The inclusion of `task` is required: without it `hand_landmarker.task` was not
precached and MediaPipe could not initialise offline. This was fixed during the
audit.

### Precached content (production build)

| Category | Examples | Offline need |
|---|---|---|
| App shell | `index.html`, JS, CSS, fonts | Yes |
| Manifest/icons | `manifest.webmanifest`, icon PNGs | Yes |
| TFLite model | `/model/signova_model.tflite` | Yes |
| Label map | `/model/labels.json` | Yes |
| Model metadata | `/model/model_info.json` | Yes |
| MediaPipe task | `/models/hand_landmarker.task` | Yes |
| MediaPipe wasm | `/wasm-vision/*` | Yes |
| LiteRT wasm | `/wasm/*` | Yes |

Observed build output: **46 entries, ~86.3 MB** in `dist`.

First installation therefore downloads a large payload (~86 MB) plus the
service-worker precache. This is expected for local inference and should be
tested on the institution's actual network and tablets.

### What is deliberately not cached

- No runtime caching rules are configured.
- API requests (`/api/*`) are not cached by the service worker.
- Socket.IO traffic is not cached.
- There is no caching of authenticated API responses, messages, session
  records, or camera frames.

This avoids serving stale or sensitive user data from the cache.

### Cache versioning and invalidation

- Workbox precache entries carry content revisions (for example
  `model/signova_model.tflite` has a revision hash).
- A new build produces new revisions; the new service worker installs, calls
  `skipWaiting` and `clientsClaim` (auto-update mode), and deletes outdated
  caches via `cleanupOutdatedCaches`.
- A changed model or label map changes the precache revision, so the new asset is
  downloaded rather than reused.
- Netlify serves `sw.js` and `registerSW.js` with
  `Cache-Control: public, max-age=0, must-revalidate` to prevent a stale worker.

After a deployment that changes the model or label map, close and reopen the
installed app once, then verify in DevTools → Application → Cache Storage that
the new revision is present.

---

## 3. Local verification results

Environment: Windows 11, Node 22.18, Chromium via Playwright, PWA production
build served at `http://localhost:4173/`.

| Check | Result | Evidence |
|---|---|---|
| Service worker registered | Passed | 1 registration, active, scope `/` |
| Manifest | Passed | Chrome DevTools `Page.getAppManifest`: no errors |
| Installability | Passed | `Page.getInstallabilityErrors`: empty |
| App shell precached | Passed | `index.html` present in `workbox-precache-v2` |
| Model precached | Passed | `signova_model.tflite` present |
| Labels precached | Passed | `labels.json` present |
| Metadata precached | Passed | `model_info.json` present |
| MediaPipe task precached | Passed | `hand_landmarker.task` present |
| LiteRT wasm precached | Passed | `litert_wasm*` present |
| MediaPipe wasm precached | Passed | `vision_wasm*` present |
| Offline reload | Passed | Browser offline, reload still rendered Signova (root text present) |
| Console errors during check | None | Playwright captured no page errors |

Repeatable scripts:

```powershell
# from apps/web-deaf-user-pwa
npm run build
npm run preview
node workspace/check-installability.mjs
```

The check script is development tooling under `workspace/` and is not part of the
deployed application.

---

## 4. Offline behaviour boundaries

| Capability | Offline behaviour |
|---|---|
| Open installed app / app shell | Works (precached) |
| Load MediaPipe task/wasm | Works (precached) |
| Load TFLite model and label map | Works (precached) |
| Camera preview | Works if the OS/browser grants camera; no network needed |
| Local landmark extraction and inference | Works once assets are installed |
| Create a new session | **Requires network** |
| Teller selection / organization data | **Requires network** |
| Send confirmed message | **Requires network** |
| Receive teller replies | **Requires network (Socket.IO)** |
| Authentication / token refresh | **Requires network** |
| Text-to-ASL animation playback | Requires the backend/SignBridge and stored video; not offline |

The app currently switches to its offline screen when session creation or socket
connection fails. It does not queue messages for later delivery. Do not claim
offline messaging.

---

## 5. Android installation test plan

Run on at least one phone and one tablet, with Chrome (and one alternative
Chromium browser if available).

1. Open `https://app.<SIGNOVA_DOMAIN>` in Chrome.
2. Confirm the install prompt or browser menu → “Install app” / “Add to Home
   screen”.
3. Install and confirm the Signova icon on the home screen.
4. Launch from the icon; confirm standalone mode (no browser address bar).
5. Confirm the branded address remains `https://app.<SIGNOVA_DOMAIN>` in the
   site settings / app info.
6. Rotate the device and check layout on phone and tablet.
7. Start the sign flow and grant camera permission.
8. Deny camera permission once, confirm the recovery screen, then re-enable in
   site settings and confirm the camera works.
9. Disconnect the network, force-stop, and relaunch: shell and model assets
   should still load; session/messaging should show the offline state.
10. Reconnect and complete a Deaf-user → teller message.

Record for each device: model, Android version, browser version, result, and
screenshot.

### Status

| Test | Status |
|---|---|
| Chromium desktop installability | Passed (headless) |
| Android phone install | Not tested |
| Android tablet install | Not tested |
| Standalone launch | Not tested on Android |
| Home-screen icon | Not tested on Android |
| Camera permission grant | Not tested on device |
| Camera permission denial/recovery | Not tested on device |
| Offline installed launch | Passed in desktop Chromium; not tested on Android |
| Real inference performance | Not tested on Android |

---

## 6. HTTPS and camera

- PWA installation and `getUserMedia` require a secure context.
- `https://app.<SIGNOVA_DOMAIN>` with a valid certificate satisfies this.
- Camera permission is requested only when the user starts signing.
- Camera frames stay in the browser; only landmark tensors are used locally.
- If permission is denied permanently, the user must recover through browser
  site settings; the app cannot override it.

---

## 7. Deployment requirements recap

| Requirement | Value |
|---|---|
| Netlify base directory | `apps/web-deaf-user-pwa` |
| Build command | `npm ci --workspaces=false --include=dev && npm run build` |
| Publish directory | `dist` |
| `VITE_API_URL` | `https://api.<SIGNOVA_DOMAIN>` |
| `VITE_USE_MODEL` | `true` |
| Custom domain | `app.<SIGNOVA_DOMAIN>` |
| HTTPS | Required |
| Service worker headers | `sw.js` / `registerSW.js` no-cache |
