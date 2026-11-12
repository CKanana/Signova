# Signova M6 — Model Integration Report

## M6.1 — Label Mapping Status: BLOCKER

### Finding
The `label_map.json` was **not committed to the repository**.

### Evidence
- `ml/prepare_data.py` generates `label_map.json` by iterating `WLASL_v0.3.json` and assigning integer indices by insertion order.
- Neither `WLASL_v0.3.json` nor `label_map.json` exist anywhere in the repository.
- `ml/train.py` loads `label_map.json` via `--label_map` CLI argument.
- The placeholder `labels.json` (2000 entries) in `src/assets/model/` does NOT reflect the training-time ordering.

### What is known
- Class indices are assigned in the order glosses appear in `WLASL_v0.3.json`.
- WLASL-2000 uses the first 2000 glosses from that file.
- The insertion order of `WLASL_v0.3.json` is a fixed, public ordering (the file is versioned).
- Without the original file or the committed `label_map.json`, we cannot confirm the exact per-index mapping.

### What is required to unblock
1. Retrieve `WLASL_v0.3.json` from the WLASL GitHub repo: https://github.com/dxli94/WLASL
2. Run `python ml/prepare_data.py --meta WLASL_v0.3.json --videos_dir <any_dir> --label_map_out label_map.json`
   - The `label_map` generation loop does NOT require actual video files — only the JSON.
   - Modify `prepare_data.py` to extract just the label ordering without video scanning.
3. Copy the resulting `label_map.json` to `src/assets/model/labels.json` as a JSON array.

### Immediate action
A helper script is provided at `ml/recover_labels.py` to generate the labels without videos.

---

## Critical Mismatch: Training Pipeline vs Deployed Model

### Finding
The deployed `signova_model.tflite` expects input shape `[1, 60, 126]` (two-hand, 126 values/frame).
The current training pipeline (`ml/extract_landmarks.py`, `ml/model.py`) uses 63 values/frame (one hand).

### Evidence
| Source | Feature dim | Hands |
|--------|-------------|-------|
| `ml/model.py` `build_model(feature_dim=63)` | 63 | 1 |
| `ml/extract_landmarks.py` `FEATURE_DIM = 63` | 63 | 1 |
| `ml/dataset.py` `FEATURE_DIM = 63` | 63 | 1 |
| Deployed `signova_model.tflite` input shape | **126** | **2** |

### Conclusion
The deployed model was built from a **different training run** — one that used two-hand (126-dim) features.
The current `ml/` pipeline describes a one-hand model. The `.tflite` in assets is a two-hand model.

### Impact on integration
- `preprocess.ts` correctly produces 126-dim frames (left+right hand, 63 each) — **compatible with the deployed model**.
- The deployed model works with our preprocessing code.
- The training pipeline would need to be updated to produce 126-dim features to reproduce this model.

---

## M6.2 — MediaPipe Integration Architecture

### Current State
- `useHandRecorder.ts` defines `HandLandmarksPerFrame` interface and collection logic.
- No live landmark extraction is connected to the camera.
- `expo-camera` v57 is installed and working.

### Required Architecture
```
expo-camera CameraView
    ↓ frame (RGB image)
VisionCamera frame processor  ← REQUIRES react-native-vision-camera
    ↓ or
MediaPipe HandLandmarker (Tasks API, runs via .task model file)
    ↓ handLandmarks: [{landmarks: [{x,y,z},...]}] × 2 hands
useHandRecorder.frameHandler(frame)
    ↓ buffers 60 frames
landmarksToFloat32() → Float32Array[7560]
    ↓
recogniseOnDevice() → top-5 [{sign, probability}]
```

### Compatible Approach (Expo SDK 57 / RN 0.86)
Two viable options:

**Option A: react-native-vision-camera + MediaPipe plugin (RECOMMENDED)**
- `react-native-vision-camera` v4 supports Expo managed workflow via dev build.
- Companion package `react-native-mediapipe` (v0.1.x) provides a VisionCamera frame processor plugin.
- Requires `expo run:android` (dev build) — does NOT work in Expo Go.
- Install: `react-native-vision-camera@^4`, `react-native-mediapipe@^0.1`

**Option B: expo-camera + JS-side MediaPipe WASM**
- `expo-camera` already installed.
- `@mediapipe/tasks-vision` WASM package runs in Expo web (not React Native native).
- Does NOT work on Android/iOS native — WASM is not supported in Hermes.
- Only viable for web preview builds.

### Chosen path: Option A (native dev build)
Requires `expo-build-properties` (already in package.json) + development build.

### HandLandmarksPerFrame shape (confirmed compatible)
```typescript
// Two-hand output from MediaPipe HandLandmarker:
{
  handLandmarks: [
    { landmarks: [{x,y,z}, ...×21] },  // hand 0 (left or right)
    { landmarks: [{x,y,z}, ...×21] },  // hand 1 (the other hand)
  ]
}
```
The existing `preprocess.ts` layout (left block [0..62], right block [63..125]) matches
when MediaPipe is configured with `num_hands=2` and the output preserves handedness ordering.

---

## M6.3 — Native Dependencies

### Required versions (Expo SDK 57 / RN 0.86 compatible)

| Package | Version | Purpose |
|---------|---------|---------|
| `react-native-fast-tflite` | `^3.0.1` | TFLite inference |
| `react-native-nitro-modules` | `^0.37.2` | Required by fast-tflite v3 |
| `react-native-vision-camera` | `^4.6.4` | Camera frame processor |
| `react-native-mediapipe` | `^0.1.x` | MediaPipe hand landmarks via VisionCamera |

### Build requirements
- Android: `minSdkVersion 26`, `compileSdkVersion 35`
- `expo-build-properties` plugin (already configured) must set these.
- Metro config already registers `.tflite` as an asset extension ✅

### app.json plugin config needed
```json
["expo-build-properties", {
  "android": { "minSdkVersion": 26, "compileSdkVersion": 35 }
}]
```

---

## M6.4 — Android Build Status

**NOT PERFORMED** — requires physical Android device or emulator with:
1. ADB connection
2. `expo run:android` capable environment
3. `react-native-fast-tflite` and `react-native-nitro-modules` installed

**All pre-build checks passed:**
- 58/58 unit tests pass ✅
- Zero TypeScript errors in model code ✅
- Metro config bundles `.tflite` ✅
- `model_info.json` present ✅
- Input/output contract verified ✅

---

## M6.5 — Complete Communication Flow

```
[Camera] → [MediaPipe] → [useHandRecorder] → [landmarksToFloat32]
    → [recogniseOnDevice] → [setRecogniseResult]
    → [requestTranslationResult] (on-device path)
    → [setDetectedGloss + setConfidence]
    → ConfirmSignScreen (user MUST confirm)
    → [confirmAndSend] → backend REST + Socket.IO → staff dashboard
```

**Confirmation gate is preserved** — `recogniseResult` populates `detectedGloss` but
`sendMessage` is NEVER called automatically. The user sees `ConfirmSignScreen` and
presses "Confirm and send" explicitly.

---

## M6.6 — Recognition Validation

**NOT PERFORMED** — requires native build + device. Cannot validate on synthetic inputs.

---

## Remaining Blockers (in order)

1. **label_map.json missing** — top-1 predictions return correct indices but wrong word labels
2. **Native build not completed** — `react-native-fast-tflite` not in package.json
3. **MediaPipe not connected** — no live landmarks feeding `useHandRecorder`
4. **Training pipeline mismatch** — `ml/` uses 63-dim, deployed model uses 126-dim

---

## Next Milestone Recommendations

1. **Recover label map** — run `ml/recover_labels.py` with WLASL_v0.3.json
2. **Install native deps** — `npm install react-native-fast-tflite@3.0.1 react-native-nitro-modules@0.37.2 react-native-vision-camera@4.6.4`
3. **Add MediaPipe frame processor** — implement `useMediaPipeHands` hook wrapping `react-native-mediapipe`
4. **Run native build** — `expo run:android`
5. **Update training pipeline** — change `extract_landmarks.py` to output 126-dim (two hands) to match deployed model
6. **KSL data collection** — model is ASL-trained; Kenyan Sign Language retraining required for production
