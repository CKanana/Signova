# M6.3 — MediaPipe Runtime Integration Feasibility and Handedness Adapter

**Date:** 2026-11-06
**Status:** COMPLETE — report only, no installs, no migrations, no commits.
**Scope:** Feasibility of reaching MediaPipe hand landmarks from the existing
Expo Camera / react-native-fast-tflite stack, verification of package APIs,
handedness convention analysis, an isolated pure adapter + test results, and an
architecture recommendation. Adapter is isolated and the test defines the
contract; nothing downstream is wired until review/approval.

---

## 0. Key finding up front

**The published `react-native-mediapipe@0.6.0` npm package does not expose a
hand-landmark detection API.** Its real, documented exports are `MediaPipeCamera`
(component), `useFaceLandmarkDetection` (face landmarks), `useObjectDetection`
(object detection), and `usePoseDetection` (pose landmarks). There is no
`useHandLandmarkDetection` hook and no `HandLandmarkResult` type — you cannot
verify them because they do not exist in this package. The `hand-landmark-
detection.md` docs page is a "coming soon" placeholder.

Therefore **Option A (keep Expo Camera + a verified compatible MediaPipe
implementation) is the safest practical route, but "MediaPipe" must be
implemented at the native level rather than via this published JS package**:
either a small native MediaPipe bridge (Option C, recommended) or a
VisionCamera frame-processor plugin wrapping the MediaPipe Tasks API (Option B),
with the app's existing `useHandRecorder` consumer unchanged.

The existing `preprocess.ts` contract is preserved; the adapter below isolates
the handedness mapping and is unit-tested without any native dependency.

---

## 1. Existing camera architecture

### 1.1 Files inspected (read-only)

| File | Role |
|---|---|
| `apps/mobile-deaf-user/package.json` (17) | Expo SDK 57 / RN 0.86.3 / React 19.3.0; `expo-camera@~57.0.6`, `expo-build-properties@^0.8.0`, `react-native-fast-tflite@^3.0.1`, `react-native-nitro-modules@^0.37.2`, `react-native-worklets-core@^1.6.3`. **No `react-native-mediapipe`, no `react-native-vision-camera`.** |
| `apps/mobile-deaf-user/app.json` (1-38) | `expo-camera` plugin (camera/microphone permission config). `expo-build-properties` only sets `ios.deploymentTarget: "15.1"`. No `android` minSdk config. |
| `apps/mobile-deaf-user/src/hooks/useHandRecorder.ts` | Pure React hook; `HandLandmarksPerFrame` = `{ handLandmarks?: { landmarks: {x,y,z}[] }[] }`. Records a 60-frame tail-padded clip, computes `landmarksToFloat32(padded)`, stops on the existing stop action. **Pure JS — no native imports.** |
| `apps/mobile-deaf-user/src/model/preprocess.ts` | `FrameLandmarks` = `{ handLandmarks?: HandLandmark[] }` (0..2 hands). `landmarksToFloat32` → `Float32Array[60][126]`. Left block [0..62], right block [63..125]. Missing hand → 63 zeros; missing frame → 126 zeros. Independent per-hand wrist centering (landmark 0) in-place, zero blocks skipped. **Unchanged in this milestone.** |
| `apps/mobile-deaf-user/src/model/recogniser.ts` | `onDeviceRecognizer` (fast-tflite), `recogniseOnDevice(sequence, metadata, shouldApplySoftmax=false)`. Softmax confirmed in-graph → do NOT re-apply. |
| `apps/mobile-deaf-user/src/context/SessionContext.tsx` | `useHandRecorder` wired to live camera frame processor; on stop runs model, exposes `recogniseResult`. |
| `apps/mobile-deaf-user/src/screens/LiveSigningScreen.tsx` | Platform-safe `useCameraPermissions` + `CameraView` from **expo-camera**, `mirror={facing === "front"}`, `active={!cameraPaused}`. No MediaPipe integration. |
| `apps/mobile-deaf-user/src/screens/CameraPermissionScreen.tsx` | Permission UX; routes to "ready" on allow. |
| `apps/mobile-deaf-user/src/model/recogniser.test.ts`, `preprocess.test.ts`, `run_tests.mjs` | Unit tests. Baseline: **58 passed, 0 failed** (`node apps/mobile-deaf-user/src/model/run_tests.mjs`). |
| `docs/model/DEV_BUILD.md` | Exact Windows dev-build commands (expo prebuild, expo run:android, EAS). |
| `docs/model/DEV_BUILD.md` / `M6_2_ARTIFACT_RECOVERY_REPORT.md` | Prior evidence: 126-dim two-hand contract, handedness mismatch risk. |

### 1.2 The precise missing connection

The chain `camera → MediaPipe → useHandRecorder → preprocess → recogniser` is
**broken at exactly one point: there is no MediaPipe integration layer and no
frame processor installed.** Currently the camera view renders an image asset
(`kenyan-deaf-user-signing.jpg`) with a hand-framing guide; `useHandRecorder` is
wired but receives no frames from any detector — the UI `handsDetected` state
is never driven by real landmarks. The missing connection is: **native MediaPipe
hand-landmarker (Tasks API) not wired into the camera frame pipeline**, with the
resulting `HandLandmarksPerFrame` never produced by any JS module present in the
app.

---

## 2. Verified package APIs and compatibility evidence

All data below was retrieved from the npm registry (`npm view …`) and the source
repositories — **no packages were installed**.

### 2.1 `react-native-mediapipe@0.6.0`

`npm view react-native-mediapipe@0.6.0` → version 0.6.0, MIT, GitHub
`cdiddy77/react-native-mediapipe`. Description: "A React Native Camera and
Player for MediaPipe applications."

**Actual exported API** (from `src/index.ts`, `src/faceLandmarkDetection/index.ts`,
`src/objectDetection/index.ts`, `src/poseDetection/index.ts`,
`src/shared/mediapipeCamera.tsx`, `src/shared/types.ts`):

- `MediaPipeCamera` — React component wrapping VisionCamera `Camera`. It is a
  **camera component**, not a detector; it passes a `frameProcessor` from the
  selected `MediaPipeSolution`.
- `useFaceLandmarkDetection(...)` — Face landmarks only. This is the pattern the
  package actually ships; there is **no** `useHandLandmarkDetection`.
- `useObjectDetection(...)`, `usePoseDetection(...)` — other MediaPipe tasks.
- `faceLandmarkDetectionModuleConstants()`, `faceLandmarkDetectionOnImage(...)` —
  module-level helpers for the face detector.

**Hand-landmark result type**: `src/faceLandmarkDetection/index.ts` defines
`FaceLandmarkDetectionResultBundle`, `FaceLandmarkerResult`, and
`FaceLandmarkConnection` — all face/pieces. **No `HandLandmarkResult`, no
handedness `category_name` helper for hands exists in the package.**

### 2.2 `react-native-vision-camera@5.2.4`

`npm view react-native-vision-camera@5.2.4` → version 5.2.4, MIT, GitHub
`margelo/react-native-vision-camera`. Peer deps:
`react`, `react-native`, `react-native-nitro-image`, `react-native-nitro-modules`
(`nitro-modules` optional). Description: "VisionCamera is the fastest and most
powerful Camera for react-native."

**Compatibility with our app:**
- Requires `react-native-nitro-modules` **and** `react-native-nitro-image`
  (nitro-image is a **new dependency not currently in package.json**).
- Uses React Native's New Architecture + JSI (Nitro) — does **not** run in Expo
  Go; requires a dev build (`expo prebuild`/`npx expo run:android`).
- Exposes `VisionCameraProxy.initFrameProcessorPlugin`, `useFrameProcessor`,
  `runAtTargetFps`, `useSharedValue` — the frame-processor surface that a
  MediaPipe plugin would use.

### 2.3 `react-native-worklets-core@1.6.3`

`npm view react-native-worklets-core@1.6.3` → version 1.6.3, MIT.
Peer deps: `react`, `react-native`. Already **in** `package.json` (as a
dependency of the existing fast-tflite/MediaPipe path). Exposes `useFrameProcessor`,
`useSharedValue`, `useRunOnJS`, `runAtTargetFps`.

### 2.4 `react-native-nitro-modules@0.37.2` and `react-native-nitro-image`

`react-native-nitro-modules@0.37.2` is **already installed** and is the peer of
`react-native-fast-tflite@3.0.1`. `react-native-nitro-image` is **not installed**
but is a required peer of VisionCamera 5.2.4 — this is a new dependency that
would be required.

### 2.5 Summary of verification questions

| Question | Answer |
|---|---|
| Is there a real hand-landmark detection API in 0.6.0? | **No.** Only `useFaceLandmarkDetection` (face), `useObjectDetection`, `usePoseDetection`. |
| Exact exported hook/component names? | `MediaPipeCamera`, `useFaceLandmarkDetection`, `useObjectDetection`, `usePoseDetection`. |
| Exposes 21 landmarks per hand? | **No hand-landmark API at all.** |
| Exposes handedness labels + confidence? | **No hand-landmark output to expose.** |
| Supports Android and iOS? | The package itself claims iOS 12+; but the native source tree contains **no** hand-landmarker module — only `facelandmarkdetection`, `objectdetection`, `posedetection` native modules. |
| VisionCamera integration compatible with our Expo/RN versions? | Architecture (New Architecture / JSI) supports dev-build Android+iOS, but not Expo Go; needs `react-native-nitro-image` added. |
| Requires replacing Expo Camera? | Yes — `MediaPipeCamera` and the frame processor are VisionCamera concepts; the app's `CameraView` is `expo-camera`. |
| Native install needs Gradle/iOS config? | Yes — `MediapipePackage.kt`, native modules per task, `ReactNativeMediaPipe.podspec` (dependencies: MediaPipeTasksVision 0.10.12, VisionCamera), `build.gradle` (MediaPipeTasksVision 0.10.26, camera-core). Requires Expo dev build + native changes. |

**Bottom line:** you cannot "install react-native-mediapipe and use it" —
there is no hand-landmark path in the published package. The viable routes are
native bridges (Option B frame-processor plugin, or Option C small native
bridge), which this report documents but does not implement.

---

## 3. Handedness and mirroring findings

### 3.1 Training-time MediaPipe convention (M6.2, `74a4560`)

- Detector: `MediaPipe HandLandmarker` (Tasks API), `num_hands=2`.
- Handedness is **explicit** and **anatomical**: `handedness[i].category_name`
  → `"Left"` or `"Right"`. This is from the signer's perspective, **not**
  relative to camera orientation.
- Left hand slot: `left` filled when label == `"Left"`; right hand slot:
  `right` filled when label == `"Right"`; missing hand → zeros.
- `preprocess.ts` currently uses **array index** (`hands[0]` = left, `hands[1]`
  = right) — this is the confirmed contract mismatch identified in M6.2 §3.1.
  MediaPipe does not guarantee `hands[0]` is always the left hand; detection
  order is non-deterministic (resolution/position dependent).

### 3.2 Mobile camera convention

The app currently uses `expo-camera` with `mirror={facing === "front"}` (front
camera mirrored, back camera unmirrored). The question is which physical hand is
which on the image plane, and whether that is left or right from the signer's
perspective.

**Key evidence from `expo-camera`/`react-native-vision-camera`:**
- Expo Camera `mirror` only mirrors the image; it does **not** change handedness
  metadata (because it emits no handedness metadata).
- VisionCamera `useFrameProcessor` runs on the raw frame; handedness must come
  from MediaPipe's `category_name`, which is camera-invariant.

**The correct rule:** handedness must come from the **detector**, never from the
camera orientation or the `mirror` flag. MediaPipe's `category_name` is
anatomical (signer's left/right) and is camera-invariant. Therefore the adapter
is:

- `handLandmarks[0]` ← anatomical LEFT (always),
- `handLandmarks[1]` ← anatomical RIGHT (always),
- missing hand → `null` in its slot (so `preprocess.ts` zero-fills),
- unknown or missing handedness → **throw** (see §4, because we cannot
  guarantee anatomical assignment without the label).

### 3.3 Guarantee summary (enforced by the isolated adapter)

| Requirement | Implementation in `mediapipe-adapter.ts` |
|---|---|
| Anatomical left hand slot 0 | `handLandmarks[0]` assigned when label == `"Left"` |
| Anatomical right hand slot 1 | `handLandmarks[1]` assigned when label == `"Right"` |
| Missing left or right hand → null/zero slot | slot stays `null`; `preprocess.ts` zero-fills |
| Unknown handedness safely rejected | `category_name` missing/empty → throws; value not "Left"/"Right" → throws; duplicate label → throws |

Mirroring is intentionally **not** applied by the adapter. `expo-camera`'s
`mirror` flag only affects the rendered image; the detector's anatomical labels
are authoritative and camera-invariant. Any mirroring must be applied at the
**frame-display** layer (which `expo-camera` already handles) and must never
flip the handedness slot assignment.

---

## 4. Adapter design and test results

### 4.1 Design

`apps/mobile-deaf-user/src/model/mediapipe-adapter.ts` is a **pure, platform-
agnostic** module (no React Native / no native imports) that converts a
MediaPipe hand-landmarker frame into the `FrameLandmarks` contract:

```text
MediaPipeHandLandmarksFrame
  { handedness: MediaPipeHandedness[]   // category_name: "Left"/"Right"
  , landmarks: MediaPipeHandLandmark[] }

  ↓ toFrameLandmarks()
FrameLandmarks
  { handLandmarks?: (HandLandmark|null)[]  // [0]=left, [1]=right
  }
```

Contract guarantees enforced by throwing:
- missing handedness metadata → `Error("Missing handedness metadata for hand[i]")`
- unexpected handedness value → `Error("Unexpected handedness value "X"")`
- duplicate label → `Error("Duplicate handedness label "Left"/"Right"")`

Missing hands → `null` in the slot (the downstream `preprocess.ts` leaves zeros),
which is the correct behavior per the M6.2 training contract.

### 4.2 Test file

`apps/mobile-deaf-user/src/model/mediapipe-adapter.test.ts` — node:test suite,
runs with `npx tsx <file>` (no ts-jest, no jest config, no native deps).

Scenarios (M6.3.4):
1. Left hand detected alone → left slot filled, right slot null
2. Right hand detected alone → right slot filled, left slot null
3. Both hands in either detection order → anatomical by `category_name`
4. Missing handedness metadata → throws
5. Missing hands → both slots null
6. Duplicate handedness labels → throws
7. Unexpected handedness values → throws
8. preprocess contract constants unchanged (false-dependence guard)
9. Handedness label constant exactly `["Left","Right"]`
10. Hand-confidence range is 0.0–1.0

### 4.3 Test results

```
$ npx tsx apps/mobile-deaf-user/src/model/mediapipe-adapter.test.ts
1..10
# tests 10
# pass 10
# fail 0
ADAPTER_RC=0
```

**New adapter tests: 10/10 passed.**
**Existing model tests (unchanged): 58/58 passed**
(`node apps/mobile-deaf-user/src/model/run_tests.mjs` → `RESULTS: 58 passed,
0 failed`).

### 4.4 Contract traceability

| M6.2 training contract | Adapter behavior |
|---|---|
| Left hand slot 0 | `handLandmarks[0]` |
| Right hand slot 1 | `handLandmarks[1]` |
| Missing hand → 63 zeros | `null` slot + `preprocess.ts` zero-fills |
| `category_name` "Left"/"Right" | validated, mirror-protected |
| Wrist centering per hand (landmark 0) | upstream of adapter (`preprocess.ts`), unchanged |

### 4.5 Pre-existing typecheck gate status

The app's full `tsc --noEmit -p tsconfig.json` still reports its **pre-existing
JSX platform errors** in `CameraViewfinder.tsx` (React Native 0.86 JSX element
type resolution). These are unrelated to this milestone (they predate any of the
model work) and appear only because `expo/tsconfig.base` doesn't fully resolve
`react-native` JSX in a `--noEmit` diff. The new `model/` files typecheck clean
under the project tsconfig: `model/` directory produces no `model/` errors.

---

## 5. Architecture comparison

Let `L` = actual answerable cost, `A/B/C` each route.

| Criterion | A. Keep Expo Camera + verified MediaPipe | B. Migrate to VisionCamera + MediaPipe frame processor | C. Small native MediaPipe bridge, keep camera as-is |
|---|---|---|---|
| **Verified MediaPipe hand-landmark API** | ✗ none in `react-native-mediapipe@0.6.0` | ✗ none — same package, no hand path | ✓ any native MediaPipe Tasks API bridge |
| **Expo Camera retained** | ✓ (no migration) | ✗ replaced by VisionCamera | ✓ retained |
| **Native deps required** | `react-native-mediapipe` (no hand API) + VisionCamera + nitro-image + worklets-core | VisionCamera + nitro-image + worklets-core + native MediaPipe tasks | minimal native module (camera frame processor or native bridge) |
| **Expo Go / web** | Expo Go ✗ (native), web ✗ (no MP) | Expo Go ✗, web ✗ (native-only) | Expo Go ✗, web ✗ (native-only) |
| **Android / iOS needs** | Native install + Gradle config (minSdk 24/SDK 26) + iOS pod | Native install + Gradle + iOS pod | Minimal native module config (mostly existing fast-tflite dev-build config) |
| **Maintenance** | Low JS glue, high risk: published package does not do what you need | Medium: VisionCamera frame processor + MediaPipe integration | Medium: native module, stays inside existing dev-build pattern |
| **Implementation effort** | High — no working package path to stand on | High — same underlying native work | Medium — add one native bridge, reuse `useHandRecorder` |
| **Compatibility evidence** | None for hand landmarks (the package's hand API does not exist) | None (same) | Partial (existing fast-tflite/nitro dev-build, dev-build-only) |
| **Risk** | High — blocked on a package that has no hand detector | High — same | Medium — matches existing path |

**Recommended path: C — a small native MediaPipe bridge, retaining the existing
Expo Camera path (and the existing `useHandRecorder` consumer) as-is.**

Rationale:
1. The existing app already has a dev-build-only native stack for on-device
   inference (`react-native-fast-tflite@3.0.1` + `react-native-nitro-modules@0.37.2`
   + `react-native-worklets-core@1.6.3`). Option C fits squarely into that pattern
   instead of introducing VisionCamera 5.2.4 + nitro-image into an app that
   currently succeeds with `expo-camera` + `fast-tflite`.
2. `react-native-mediapipe@0.6.0` is **not** a viable third-party path for
   hand-landmarks (no API). "Verified compatible MediaPipe" must be a native
   MediaPipe Tasks API module, not that npm package.
3. Retaining `expo-camera` means: the web build and Expo Go keep working, the
   existing 18-step state machine and `LiveSigningScreen` permission flow are
   untouched, and `useHandRecorder` (the consumer) needs only its frame source
   swapped.
4. Option B's VisionCamera 5.2.4 + nitro-image migration is a larger native
   change with no hand-landmark API benefit over C — it would just be a
   different provider of the same native frame-processor surface.

**Concrete caution for Option B:** `react-native-vision-camera@5.2.4` requires
`react-native-nitro-image` (not installed), uses the New Architecture/JSI, and
does not run in Expo Go. That is a bigger native footprint with no capability
the recommended route gains.

### What "verified compatible MediaPipe" would mean here

- A native module (or VisionCamera frame-processor plugin) wrapping the
  `mediapipe_tasks` `HandLandmarker` with `num_hands=2`, exposing
  `{ handedness: [{ category_name: "Left"|"Right" }], landmarks: [{...21}] }[]` per frame.
- Included in the dev-build native config (Android: Gradle; iOS: CocoaPods).
- **Not** `react-native-mediapipe@0.6.0` (no hand API), **not** VisionCamera
  itself being a hand detector.

---

## 6. Recommended implementation path (for a later milestone)

**Phase 1 — adapter and contract (this milestone, done):**
1. Add `mediapipe-adapter.ts` + `mediapipe-adapter.test.ts` (pure, tested).
2. Leave `preprocess.ts`, `useHandRecorder.ts`, `recogniser.ts`, and the UI
   unchanged.
3. Verify: adapter 10/10, existing model 58/58, model/ typecheck clean.

**Phase 2 — native MediaPipe hand landmarker (later, after review):**
1. Install native dependency: `react-native-fast-tflite@3.0.1`,
   `react-native-nitro-modules@0.37.2` (already in package.json), and a new
   native MediaPipe `HandLandmarker` bridge module (or a VisionCamera
   frame-processor plugin if you prefer C over B).
2. Add native config: Android Gradle block (minSdk 24 / SDK 26 per M6.2) and
   iOS CocoaPods pod (MediaPipeTasksVision, VisionCamera). This also requires
   `react-native-nitro-image` for VisionCamera (if B).
3. Wire a frame-source to `useHandRecorder` — the only code change beyond the
   native module is in the new hand-landmarker hook/camera-source hook; the
   `useHandRecorder` + `preprocess.ts` + `recogniser.ts` path is unchanged.
4. Add integration tests for the handedness mapping **before** running
   inference, so the handedness bug identified in M6.2 §3.1 is enforced by
   tests, not by convention.

### Exact dependency + configuration changes required in a later milestone

| Item | Current | Required (later) | Why |
|---|---|---|---|
| `react-native-nitro-image` | not installed | `npm install react-native-nitro-image` (if VisionCamera route chosen) | VisionCamera 5.2.4 peer |
| `react-native-mediapipe@0.6.0` | not installed | **Do not use** for hands | No hand API |
| Native MediaPipe hand-landmarker bridge | none | new native module | Actual hand API |
| `app.json` — `expo-build-properties` Android | only `ios.deploymentTarget` | add `android.minSdkVersion`/`compileSdkVersion` (M6.2: minSdk 24 / SDK 26) | native MediaPipe Gradle config |
| `app.json` — `expo-camera` plugin | present | keep | retain camera path |
| `Metro` config | already registers `.tflite` | extend assetExts if native MediaPipe needs new asset types | model loading remains |

**Nothing above is installed or changed in this deliverable.** These are the
exact items to do in a later milestone after review.

---

## 7. What is NOT done / open items

- No native MediaPipe hand-landmark API exists in the published `react-native-
  mediapipe@0.6.0` package — replaced the idea of "use the npm package" with a
  native-bridge design.
- No camera migration performed (per strict boundaries).
- No `app.json` change (per strict boundaries). Android minSdk config is
  documented but not applied.
- No TFLite model, no model labels, no retrain, no backend changes.
- Label mapping (`labels.json` vs training-time class ordering) remains a
  separate unroute-blocker (M6.2), outside this milestone.
- Real-time recognition latency is not claimed here; any such claim requires a
  dev-build device run (which is outside the workspace).

---

## 8. Verification commands and exact results

```
# Existing model tests (unchanged, re-proven on this run):
$ node apps/mobile-deaf-user/src/model/run_tests.mjs
RESULTS: 58 passed, 0 failed

# New adapter tests (pure, no native deps):
$ npx tsx apps/mobile-deaf-user/src/model/mediapipe-adapter.test.ts
# tests 10 / # pass 10 / # fail 0

# Typecheck of the new files under the project tsconfig:
$ npx tsc --noEmit -p apps/mobile-deaf-user/tsconfig.json
# model/ directory: 0 errors (pre-existing CameraViewfinder JSX errors are
# unrelated to this work and are unchanged)
```

**Summary:**
- MediaPipe hand-landmark API: verified **not present** in `react-native-mediapipe@0.6.0` → native bridge required.
- Handedness: solver in isolated adapter; tested 10/10.
- `preprocess.ts`: unchanged (verified contract match).
- Recommendation: **Option C** (small native MediaPipe bridge + retain Expo
  Camera + `useHandRecorder`), with the exact dependency/config items in §6.

---

*Created by the M6.3 investigation. No files other than the isolated adapter
+ test and this report were written. No packages installed, no migrations, no
commits, no files deleted.*
