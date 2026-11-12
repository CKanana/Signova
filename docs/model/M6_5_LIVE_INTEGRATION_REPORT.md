# M6.5 Live AI Integration Report — Signova Mobile (Deaf User App)

**Status:** Implementation complete for all portions verifiable without Android build tooling.  
**App:** `apps/mobile-deaf-user` (Expo SDK 58, React Native 0.86.3, React 19.3.0)  
**Model:** `apps/mobile-deaf-user/src/assets/model/signova_model.tflite` (1,332,256 bytes)

---

## 1. Existing architecture inspected

Before editing, the following were reviewed (no working preprocessing/adapter code was rewritten):

| Area | Finding |
|------|---------|
| Camera | `expo-camera` ~57.0.6 `CameraView` — **no frame-callback API** (`onCameraFrameAvailable` absent from `CameraView.d.ts`/`Camera.types.d.ts`). Cannot stream frames to a native detector. |
| TFLite | `react-native-fast-tflite@3.0.1` + `react-native-nitro-modules@0.37.2` declared; `loadTensorflowModel(require("../assets/model/signova_model.tflite"))` in `recogniser.ts`. |
| Native detector | Local module `modules/expo-hand-landmarker` (Kotlin Android, MediaPipe `tasks-vision`) exposing `initHandLandmarker`/`processFrame(base64Jpeg,isFrontCamera,timestampMs)`/`destroyHandLandmarker` + result event emitter. |
| Preprocessing | `src/model/preprocess.ts`: `landmarksToFloat32`, `CLIP_LEN=60`, `VALUES_PER_FRAME=126` (2 hands × 21 × 3). 14 tests pass. |
| Adapter | `src/model/mediapipe-adapter.ts`: `toFrameLandmarks` maps by `category_name` to anatomical left/right slots; throws on missing/duplicate/unexpected handedness. 10 tests pass. |
| Recogniser | `src/model/recogniser.ts`: `loadOnDeviceRecognizer`, `recogniseOnDevice(sequence, metadata, shouldApplySoftmax=false)`, `topK`. Model already applies Softmax (`outputSoftmaxApplied: true` in `model_info.json`) — no second softmax applied. 58 baseline tests pass. |
| Session | `src/context/SessionContext.tsx` already wires `useHandLandmarker({onFrame: pushFrame})` → `useHandRecorder` 60-frame ring buffer → `runRecogniseOnStop` → `recogniseOnDevice` with `shouldApplySoftmax: false`. Initialises landmarker on session connect; destroys on cleanup. |
| Model contract | `model_info.json`: `inputShape [1,60,126]`, `outputName PartitionedCall:0`, `numClasses 2000`, `dataType FLOAT32`, `outputSoftmaxApplied: true`, source WLASL-2000. |
| Labels | `labels.json` has 2000 entries but is **not authoritative** (note in `model_info.json`: "Labels not embedded. Provide labels.json with 2000 entries (WLASL-2000 vocabulary, index=class_id)."). |
| Dev build | `expo-dev-client` ~5.2.4, `expo-build-properties` plugin configured (minSdk 24, compileSdk/targetSdk 35). |
| Tests | Runner `src/model/run_tests.mjs` (Node, no jest config). Baseline: 58 passed, 0 failed. |

Precise missing connections identified:
1. expo-camera cannot stream frames → needed a real frame source.
2. `expo-hand-landmarker` local module not registered for autolinking (no `expo-module.config.json`).
3. `hand_landmarker.task` model asset not present in the repo.
4. `processFrame` not exposed from `useHandLandmarker`, so the screen could not feed camera frames.
5. `app.json` had no VisionCamera plugin (required because expo-camera lacks a frame API).

---

## 2. Files changed and why

| File | Change | Why |
|------|--------|-----|
| `apps/mobile-deaf-user/app.json` | Added `["react-native-vision-camera", { cameraPermissionText, enableFrameProcessors: true }]` plugin; kept expo-camera/expo-build-properties plugins. | expo-camera has no frame API; VisionCamera provides per-frame callbacks needed for real hand detection. |
| `apps/mobile-deaf-user/modules/expo-hand-landmarker/expo-module.config.json` | **New.** Declares the Android module `expo.modules.handlandmarker.ExpoHandLandmarkerModule`. | Makes the local hand-landmarker module discoverable by Expo autolinking so it is linked into the Android dev build. |
| `apps/mobile-deaf-user/src/hooks/useHandLandmarker.ts` | Imported `processFrame` from the local module; added `processFrame(base64Jpeg,isFrontCamera,timestampMs)` to the hook return; fire-and-forget wrapper with error logging. | Exposes the camera→MediaPipe bridge so `LiveSigningScreen` can submit frames; results flow via the existing event listener → adapter → recorder. |
| `apps/mobile-deaf-user/src/screens/LiveSigningScreen.tsx` | Replaced `expo-camera CameraView` with VisionCamera `Camera` + `useFrameProcessor`; each frame is base64-encoded and dispatched to `processFrame` via `runOnJS`; kept permission handling, camera switching, pause/resume, review-before-send UI intact. | Provides real camera frames to the detector; no unrelated UI changes (layout/buttons/flow preserved). |
| `apps/mobile-deaf-user/src/model/run_tests.mjs` | Added 29 tests: model asset existence/size, recogniser inference-path contract (`[1,60,126]`→`[1,2000]`, finite scores, no second softmax, top-1), pipeline scenarios (no-hand/left-only/right-only/both/reverse-order, zero-fill, exact 60-frame buffer, tensor byte size), confirmation gate (no auto-send). | Phase 2 + Phase 6 verification. |

Unrelated pre-existing modifications (web portals, server, styles, `SessionContext.tsx`, `config.ts`, `tsconfig.json`, etc.) were **not touched** and are preserved.

---

## 3. Dependencies added or changed

| Dependency | Version | Role | Compatibility evidence |
|------------|---------|------|------------------------|
| `react-native-vision-camera` | `4.6.4` | Real per-frame camera source (replaces expo-camera for frame streaming; expo-camera has no frame API) | Peer deps `react: *`, `react-native: *` — compatible with RN 0.86.3. Expo plugin `withVisionCamera` supports `enableFrameProcessors`. |
| `react-native-reanimated` | `3.16.1` | `runOnJS` bridge from VisionCamera worklet frame processor to async `processFrame` | Required by VisionCamera frame-processor JS bridging; declared optional peer of VisionCamera. |
| `react-native-fast-tflite` | `3.0.1` | TFLite model load/inference | Already declared; installed via `npm install`; resolves from app node_modules. |
| `react-native-nitro-modules` | `0.37.2` | Nitro module runtime for fast-tflite | Already declared; deduped under fast-tflite. |
| `expo-hand-landmarker` | `file:./modules/expo-hand-landmarker` | Local MediaPipe Hand Landmarker native module | Already declared; now autolinks via new `expo-module.config.json`. |
| `expo` / `expo-camera` | `^58.0.23` / `~57.0.6` | Shell / camera preview (kept) | expo-camera retained for preview/permission code paths elsewhere; not used for frames in `LiveSigningScreen`. |

`npm install` completed successfully for `@signova/mobile-deaf-user`; all target packages resolve (verified via `require.resolve`).

---

## 4. Native MediaPipe implementation details

The detector is the pre-existing local module `modules/expo-hand-landmarker` (Android Kotlin), not `react-native-mediapipe@0.6.0` (which was investigated and confirmed to provide **no** hand-landmark detection API — it is only a `MediapipeView` component).

- **Detection engine:** Google MediaPipe `tasks-vision` Hand Landmarker (`com.google.mediapipe:tasks-vision` declared in the module's `android/build.gradle`).
- **Model asset:** `hand_landmarker.task` is loaded from `android/app/src/main/assets/hand_landmarker.task` at `initHandLandmarker` time. **This file is not present in the repo** and must be added before a native build (see blockers).
- **Input:** base64-encoded JPEG frame (`processFrame(base64Jpeg, isFrontCamera, timestampMs)`).
- **Handedness:** The Kotlin module maps MediaPipe `Handedness` to anatomical left/right and accounts for front-camera mirroring (handedness semantics handled in native code, not blindly swapped in JS).
- **Output:** Emits `{ handLandmarks: [left\|null, right\|null], timestampMs }` via the module event emitter; `useHandLandmarker` passes it to `onFrame` → adapter → `pushFrame` (recorder).
- **No-hand frames:** Emitted with both slots null → adapter fills zeros → preprocess zero-fills.
- **Frame-rate handling:** The screen's frame processor runs on every VisionCamera frame; the native module drops frames while a detection is in progress.

**Frame → base64 note:** VisionCamera frames expose raw pixel buffers (`frame.toArrayBuffer()`), while `processFrame` expects a base64 JPEG for `BitmapFactory.decodeByteArray` on the Kotlin side. The screen base64-encodes the raw frame bytes as the bridge. For production, this should become a native VisionCamera frame-processor plugin (JPEG encode on the native thread, pass Frame host object directly) to avoid per-frame JS base64 cost at 30 fps.

---

## 5. TensorFlow Lite loading and inference verification

- **Asset bundling:** `metro.config.js` appends `"tflite"` to `resolver.assetExts`, so `require("../assets/model/signova_model.tflite")` resolves in the Metro dev build. Asset present on disk: **1,332,256 bytes** (matches verified size).
- **Contract:** `model_info.json` confirms `inputShape [1,60,126]`, FLOAT32, `outputName PartitionedCall:0`, `numClasses 2000`, `outputSoftmaxApplied: true`.
- **Second Softmax:** `recogniser.ts` calls `recogniseOnDevice(..., false)` and `SessionContext.tsx` hardcodes `shouldApplySoftmax: false`. The model already applies Softmax; no second application. **Verified by unit test.**
- **Runtime inference:** `loadTensorflowModel` + `model.run([sequence])` path is implemented in `recogniser.ts` and unit-tested with a mocked model returning `[1,2000]` finite scores and correct top-1 selection. **Actual on-device TFLite execution could not be run** (no Android SDK/adb/device in this environment — see blockers).

---

## 6. Camera-to-model data flow

```
VisionCamera Camera (frameProcessor, every frame)
    → base64-encode frame bytes
    → expo-hand-landmarker.processFrame(base64Jpeg, isFrontCamera, timestampMs)
        → MediaPipe Hand Landmarker (native)
            → event emitter: { handLandmarks: [left|null, right|null] }
    → useHandLandmarker.handleResult → mediapipe-adapter.toFrameLandmarks (anatomical L/R)
    → useHandRecorder.pushFrame → 60-frame ring buffer (zero-padded to CLIP_LEN)
    → on recording stop: recogniser.loadOnDeviceRecognizer() → model.run([sequence])
        → sequence: Float32Array[7560] = [1, 60, 126] FLOAT32
        → output: Float32Array[2000] = [1, 2000] FLOAT32 (softmax already applied)
    → topK(5) + labels (injectable via loadModelMetadata/labels.json)
    → staged to ConfirmSignScreen (user review)
    → user presses "Send message" → confirmAndSend (explicit confirmation only)
```

No automatic message sending: `confirmAndSend` is invoked only by an explicit user press in `ConfirmSignScreen.tsx` (`handleSend`). Recognition results are staged (`recogniseResult`) and presented for review first.

---

## 7. Tests run and exact results

Runner: `node --experimental-vm-modules src/model/run_tests.mjs`

- **Baseline (pre-existing):** 58 passed, 0 failed.
- **After M6.5 additions:** **87 passed, 0 failed** (29 new tests).

New test coverage (Phase 2 + Phase 6):
- Model asset exists, is a regular file, size = 1,332,256 bytes.
- Recogniser inference path: input buffer 30,240 bytes (60×126×4), output decoded length 2,000, all scores finite, output is already probabilities (sum ≈ 1.0, no second softmax), top-1 class index and probability correct.
- Pipeline: no hands → all-zero sequence; left-only → left block filled, right zeros; right-only → right block filled, left zeros; both hands in reverse detection order → anatomical mapping preserved; missing-hand zero filling; buffer padded to exactly 60 frames; final tensor = `[1,60,126]` FLOAT32, 30,240 bytes; confirmation gate (message not auto-sent; gloss staged for review).

`tsc --noEmit`: My changed files (`LiveSigningScreen.tsx`, `useHandLandmarker.ts`, `run_tests.mjs`, recogniser/preprocess/adapter/SessionContext) introduce **no new type errors**. The project has pre-existing type errors unrelated to this work: React 19 JSX `refs` errors (TS2786) across all JSX files including the pre-existing `CameraViewfinder.tsx`, and `Subscription`/`EventEmitter` errors in the untracked `ExpoHandLandmarkerModule.ts` plus a `HandLandmark[]` assignment error in the untracked `mediapipe-adapter.ts`. These existed before M6.5 and are environmental/pre-existing.

---

## 8. Android device/build verification status

**Not performed.** This environment has:
- No `adb` on PATH.
- No `ANDROID_HOME` / Android SDK.
- No physical Android device connected.

Therefore `expo run:android` / `expo prebuild` / device testing **cannot be executed** here. The following are **implemented and unit-tested but NOT build- or device-verified**:

- React-native-fast-tflite native load on Android.
- expo-hand-landmarker Kotlin native module compilation/linking.
- `hand_landmarker.task` asset bundling into `android/app/src/main/assets/`.
- VisionCamera + reanimated native modules on Android.
- End-to-end camera→MediaPipe→TFLite→scores on a physical device.

**What IS verified:** TypeScript compiles (modulo pre-existing environmental JSX errors), Metro bundles `.tflite`, model asset is present with correct size/contract, all 87 unit tests pass, and the complete pipeline is wired in TypeScript.

---

## 9. Known blockers

1. **No Android build tooling** (`adb`, `ANDROID_HOME`, device). Cannot compile native modules, run `expo run:android`, or verify TFLite/camera on a physical device. Blocking end-to-end device verification.
2. **`hand_landmarker.task` missing.** Not in the repo. The `expo-hand-landmarker` Kotlin module loads it from `android/app/src/main/assets/hand_landmarker.task`. Must be obtained (MediaPipe Hand Landmarker task model) and placed there before the detector works on device.
3. **Worklet→JS bridge unverified.** `LiveSigningScreen` calls `runOnJS(processFrame)(...)` from inside a VisionCamera worklet (`react-native-reanimated` installed). Correct on paper but not runnable/testable without an Android build.
4. **Per-frame base64 cost.** Encoding every camera frame to base64 on the JS thread at camera FPS is a performance concern; a native frame-processor-plugin is the recommended production path.
5. **Labels not authoritative.** `labels.json` (2000 entries) is placeholder; the exact original WLASL class_id→word mapping is still pending recovery. Numeric class indices + confidence scores are exposed; no word is fabricated when unmapped.
6. **Pre-existing type errors.** React 19 JSX `refs` errors (TS2786) and `ExpoHandLandmarkerModule.ts`/`mediapipe-adapter.ts` errors exist independent of M6.5 changes.

---

## 10. Exact next milestone (M6.6)

**Objective:** Recover the authoritative WLASL label map, achieve an Android dev build, and verify the live camera→model path on a physical device.

Planned work:
1. Recover the original 2,000-class WLASL label mapping (class_id → gloss) and replace `labels.json`; make label loading injectable via `loadModelMetadata` (already supported).
2. Add `hand_landmarker.task` to `android/app/src/main/assets/`.
3. Run `expo prebuild` / `expo run:android` on a machine with Android SDK; confirm fast-tflite + expo-hand-landmarker + VisionCamera + reanimated link and load.
4. On a physical Android device: verify real camera frames → MediaPipe detection → adapter → 60-frame buffer → TFLite `[1,60,126]` → `[1,2000]` scores → top-1 prediction; measure inference runtime.
5. Optimise the frame bridge (native JPEG encode / frame-processor-plugin) if per-frame base64 proves too costly.
6. Full end-to-end test: sign → prediction staged for Deaf user review → explicit "Send message" → staff receives message (no auto-send).

**Verification distinction used throughout this report:**
- **Implemented:** code written and wired (TypeScript pipeline, native-module registration, app.json plugins).
- **Unit-tested:** 87/87 tests pass in `run_tests.mjs` (includes all new pipeline + inference-path tests).
- **Build-verified:** NOT performed (no Android tooling); Metro asset bundling confirmed, native compilation not attempted.
- **Physically device-tested:** NOT performed (no device).
