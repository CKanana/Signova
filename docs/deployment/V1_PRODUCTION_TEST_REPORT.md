# Signova V1 — Production Test Report

**Report date:** 2026-11-18  
**Scope:** Signova V1 deployment readiness, three Netlify frontends, Render
backend, PWA, TFLite, and end-to-end communication.  
**Domain:** `<SIGNOVA_DOMAIN>` (not supplied)  
**Environment:** Windows 11 Pro, Node `v22.18.0`, npm `10.9.3`, Chromium via
Playwright 1.64 (headless).

Result vocabulary: **Passed**, **Failed**, **Not tested**, **Blocked**.

---

## 1. Summary

| Area | Required verification | Status | Evidence |
|---|---|---|---|
| Repository audit | Structure, env, PWA/model/assets | **Passed** | Audit document; source inspection |
| Clean install | `npm ci` reproducibility | **Passed** | Root and per-app `npm ci --dry-run` succeed |
| Backend build | TypeScript production build | **Passed** | `tsc -p tsconfig.build.json` exits 0 |
| Admin build | TypeScript + Vite build | **Passed** | `tsc -b && vite build` exits 0 |
| Teller build | TypeScript + Vite build | **Passed** | `tsc --noEmit && vite build` exits 0 |
| PWA build | TypeScript + Vite + Workbox | **Passed** | 46 precache entries, ~86.3 MB |
| Production env audit | No localhost/dev tunnel in bundles | **Passed** | Rebuilt with `https://api.signova.test`; zero devtunnel strings; zero localhost in teller/admin |
| Namecheap | Domain registration and DNS | **Blocked** | Domain not purchased/provided |
| Custom domains | All four subdomains resolve | **Blocked** | Depends on DNS |
| HTTPS | Valid certificates on all four | **Blocked** | Depends on DNS + hosting |
| Render | Backend and database health | **Not tested** | No Render deployment or Atlas access |
| Netlify PWA | Production build, routing | **Not tested** | No Netlify site |
| Netlify teller | Production build, routing, API | **Not tested** | No Netlify site |
| Netlify admin | Production build, routing, API | **Not tested** | No Netlify site |
| PWA installability | Manifest + install criteria | **Passed** | Chromium: 0 manifest errors, 0 installability errors |
| PWA installation | Android phone and tablet | **Not tested** | No physical device |
| Camera | Permissions and live camera | **Not tested** | No physical device; headless Chromium |
| MediaPipe | Landmark extraction on device | **Not tested** | No camera/device; code and asset presence inspected |
| TFLite | Model loading and inference | **Passed** | Chromium: contract valid, 39.1 ms with zeros |
| Label map | Correct class mapping | **Passed** | 7/7 label tests, 2,000 authoritative labels |
| Preprocessing | `[1,60,126]` contract | **Passed** | 18 preprocessing tests |
| Offline | Cached app and model assets | **Passed** | Offline reload rendered app; all critical assets cached |
| Socket.IO | Real-time communication | **Passed (local)** / **Not tested (production)** | In-process integration: session request/accept, reject, socket auth, message flow |
| Authentication | Login and permissions | **Passed (local)** / **Not tested (production)** | 2FA, refresh rotation/reuse, RBAC, org isolation suites |
| End-to-end | Deaf-user ↔ teller workflow | **Passed (local)** / **Not tested (production)** | Integration suite: kiosk session → staff socket → messages → end |
| Text-to-ASL / SVG | Staff reply animation | **Not tested** | SignBridge not deployed; not part of this hosting plan |

---

## 2. What was actually tested

### 2.1 Builds

| Command | Result |
|---|---|
| `npm run build --workspace @signova/server` | Passed |
| `npm run build --workspace @signova/web-admin-portal` | Passed |
| `npm run build --workspace @signova/web-hearing-staff` | Passed |
| `VITE_API_URL=https://api.signova.test VITE_USE_MODEL=true npm run build --workspace @signova/web-deaf-user-pwa` | Passed |
| `npm ci --dry-run` (root) | Passed |
| `npm ci --dry-run --workspaces=false` (PWA, staff, admin, server) | Passed |

Bundles were re-checked for development URLs:

| App | `devtunnels` | `localhost` | production API string |
|---|---:|---:|---:|
| PWA | 0 | 0 | 1 |
| Teller | 0 | 0 | 1 |
| Admin | 0 | 0 | 1 |

The scan used placeholder `https://api.signova.test`. The real domain will be
injected at Netlify build time.

### 2.2 PWA manifest, service worker, offline

| Check | Result | Evidence |
|---|---|---|
| Service worker active | Passed | 1 registration, scope `/` |
| Manifest errors | Passed | 0 |
| Installability errors | Passed | 0 |
| `index.html` cached | Passed | Workbox precache |
| `signova_model.tflite` cached | Passed | Workbox precache |
| `labels.json` cached | Passed | Workbox precache |
| `model_info.json` cached | Passed | Workbox precache |
| `hand_landmarker.task` cached | Passed | Workbox precache (after glob fix) |
| LiteRT + MediaPipe wasm cached | Passed | Workbox precache |
| Offline reload | Passed | Page title “Signova”, app root rendered while offline |
| Page errors | Passed | None captured |

Browser: Chromium (Playwright 1.64), desktop viewport 390×844 emulation.

### 2.3 TFLite and labels

| Check | Result |
|---|---|
| Model loads under LiteRT.js | Passed |
| Input shape `[1,60,126]` | Passed |
| Input type float32 | Passed |
| Output shape `[1,2000]` | Passed |
| Output type float32 | Passed |
| Actual input name | `landmark_sequence` (brief says `serving_default_landmark_sequence:0`) |
| Actual output name | `output_0` (brief says `PartitionedCall:0`) |
| Inference executes | Passed (39.1 ms, zero input) |
| Label count 2,000 | Passed |
| No placeholders/duplicates | Passed |
| First 13 training-order labels | Passed |
| Preprocess `[60,126]` layout | Passed (25/25 model tests) |

The tensor **name** discrepancy is a metadata/documentation issue, not a
functional failure: the recogniser reads actual names and validates shape/dtype at
runtime.

### 2.4 Backend integration tests

Run against the real Express app, real Socket.IO server, and an in-memory MongoDB
(not the deployed Render/Atlas environment).

| Suite | Result |
|---|---|
| `test/bootstrap.test.ts` | **37 passed, 0 failed** |
| `test/integration.test.ts` | **170 passed, 0 failed** |

Covered by those two suites:

- Health endpoint and DB-connected state.
- Seed idempotency.
- Staff/admin login, 2FA enrollment and activation, TOTP replay rejection.
- Refresh-token rotation, reuse detection, logout invalidation.
- RBAC: staff blocked from admin routes, admin allowed.
- Organization isolation for cross-org reads.
- Bootstrap admin accept/activate/recovery/replay/expiry.
- Invitation creation, acceptance, replay protection, resend setup token.
- Kiosk public org/teller/session creation and device token.
- Session lifecycle: create, staff socket receives request, accept, reject, end.
- Message flow: Deaf message persisted, staff reply, retrieval.
- Socket.IO authenticated connections and session-room notifications.

A single combined `npm test` run over every test file was also attempted; it
timed out at 15 minutes and showed cross-suite interference from suites sharing
process-wide state. The two suites above were then run individually and passed.
The remaining suites (`org-isolation`, `invite-token-no-login`, `admin`,
`m1_ran`, etc.) are not counted as passes in this report.

### 2.5 Security and configuration fixes during the audit

| Finding | Status |
|---|---|
| Clean `npm ci` failed (`@signova/web-dashboard-shell` E404) | Fixed |
| Root lockfile missing PWA workspace | Fixed |
| Server build failed (13 TS errors) | Fixed |
| Admin build failed (missing recovery API method) | Fixed |
| Admin API ignored `VITE_API_URL` | Fixed |
| Admin teller link hardcoded localhost | Fixed |
| Socket.IO CORS reflected any origin | Fixed |
| PWA did not precache `hand_landmarker.task` | Fixed |
| Public `auth_bridge.html` exposed admin tokens | Neutralized; **credential rotation still required** |

---

## 3. Failures and open risks

| Item | Severity | State |
|---|---|---|
| Committed `auth_bridge.html` contained access + refresh tokens | Critical | File sanitized; tokens remain in git history. Rotate secrets and revoke the admin refresh token before production. |
| No Android device testing | High | Open. Blocks the V1 device acceptance requirement. |
| No deployed Render/Netlify environment | High | Open. No production runtime verification. |
| No domain/DNS/certificates | High | Blocked on owner. |
| SignBridge not hosted; MP4s on ephemeral disk | Medium | Text-to-ASL cannot be claimed in production. |
| PWA access token in `localStorage` | Medium | Accepted kiosk risk; mitigate with HTTPS, no third-party scripts, short TTL. |
| PWA bundle 665 kB + ~86 MB install payload | Medium | First install on slow networks needs measurement. |
| API rate limit 300/15 min per IP | Medium | Verify against institutional NAT/kiosk polling after go-live. |
| Backend health says `status: ok` when DB is disconnected | Low | Use `dbConnected` in monitoring. |
| Committed `dist/` and temporary scripts | Low | Do not publish repository `dist/`; Netlify must rebuild. Clean-up requires owner approval. |

No test in this report should be read as a production pass unless the Status
column says **Passed** and the evidence refers to a deployed address. All
production passes above are build- or local-browser-level.

---

## 4. Device/browser matrix

| Environment | Used | Result |
|---|---|---|
| Windows 11 + Chromium (Playwright headless) | Yes | PWA installability, offline, TFLite, labels |
| Node 22.18 on Windows | Yes | Builds and unit tests |
| Android phone (Chrome) | No | Not tested |
| Android tablet (Chrome) | No | Not tested |
| iOS/Safari | No | Not tested; not a V1 requirement |
| Deployed Netlify domains | No | Not available |
| Deployed Render API | No | Not available |

When Android testing is performed, record: manufacturer/model, Android version,
Chrome version, installed vs browser tab, camera permission result, model load
time, inference time, and screenshots.

---

## 5. Go-live gate

The V1 deployment may be called production-ready only when all of the following
are true:

1. Domain supplied; all four CNAMEs verified.
2. HTTPS certificates issued on all four subdomains.
3. Render health reports `dbConnected: true`.
4. Netlify `VITE_API_URL` points to the real API for all three apps.
5. Production CORS/Socket.IO allowlist contains exactly the three frontend
   origins.
6. Exposed administrator/JWT credentials rotated.
7. A real administrator and teller can authenticate with 2FA.
8. A Deaf user can create a session, confirm a locally recognised sign, and the
   teller receives it via Socket.IO.
9. Teller reply reaches the PWA and is displayed.
10. Administrator RBAC restrictions are exercised.
11. PWA installs on a real Android phone and tablet, camera works, and offline
    model assets load.
12. TFLite inference and label mapping pass on those devices.
13. SignBridge is either deployed and tested or explicitly marked unavailable.

Items 1–6 are external provisioning and owner approvals; items 7–13 require a
live environment and devices.
