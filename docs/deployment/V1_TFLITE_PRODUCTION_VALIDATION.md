# Signova V1 — TFLite Production Validation

**Model:** V1 (unchanged)  
**Application:** `apps/web-deaf-user-pwa`  
**Runtime:** LiteRT.js (`@litertjs/core`) in the browser, WASM/XNNPACK  
**Status:** model load, tensor contract, label map, and one inference verified in
desktop Chromium. Physical Android phones/tablets and real camera/MediaPipe
recognition are **not tested**.

The V1 model and label map were not retrained, replaced, or modified.

---

## 1. Assets

| Asset | Path | Size | SHA-256 |
|---|---|---:|---|
| TFLite model | `apps/web-deaf-user-pwa/public/model/signova_model.tflite` | 1,332,256 B | `E2B5B473EB1F402C07A3377B3357DA884F898661EEFB55CA4A20897C1504900F` |
| Label map | `apps/web-deaf-user-pwa/public/model/labels.json` | 26,018 B | `10B5B677B1F2789851646D0CD06BB498F585C812DC48B03FDF6F1CE4ED1F531A` |
| Model metadata | `apps/web-deaf-user-pwa/public/model/model_info.json` | 479 B | — |
| MediaPipe hand task | `apps/web-deaf-user-pwa/public/models/hand_landmarker.task` | 7,819,105 B | `FBC2A30080C3C557093B5DDFC334698132EB341044CCEE322CCF8BCF3607CDE1` |

Record these hashes in the release notes. A production build that changes them
is not the same model/label pair.

---

## 2. Tensor contract — expected vs actual

The task brief cites:

| Direction | Expected name | Shape | Type |
|---|---|---|---|
| Input | `serving_default_landmark_sequence:0` | `[1,60,126]` | FLOAT32 |
| Output | `PartitionedCall:0` | `[1,2000]` | FLOAT32 |

The actual exported binary, verified by loading it with LiteRT.js in Chromium,
reports:

| Direction | Actual name | Shape | Type |
|---|---|---|---|
| Input | `landmark_sequence` | `[1,60,126]` | float32 |
| Output | `output_0` | `[1,2000]` | float32 |

**Interpretation:** shapes, types, class count, and preprocessing contract match.
Only the tensor names differ from the brief. `src/model/recogniser.ts` discovers
the names at runtime via `getInputDetails()` / `getOutputDetails()` and validates
shape and dtype, so it does not depend on the stale names. Do not hard-code the
brief's names.

`model_info.json` states:

- `numClasses`: 2000
- `inputShape`: `[1,60,126]`
- `inputName`: `serving_default_landmark_sequence:0` (stale metadata)
- `outputName`: `PartitionedCall:0` (stale metadata)
- `outputSoftmaxApplied`: true
- source: WLASL-2000

The app uses `model_info.json` for class count/shape but trusts the runtime
tensor details for names and dtypes. Inference is called with
`shouldApplySoftmax = false`, matching `outputSoftmaxApplied: true`.

---

## 3. Label map

Verified programmatically:

| Test | Result |
|---|---|
| Exactly 2,000 entries | Passed |
| No duplicates | Passed |
| No empty entries | Passed |
| Zero placeholder (`class_NNNN`) entries | Passed |
| First 13 match training order | Passed |
| Last label | `whistle` |

First entries: `book, drink, computer, before, chair, go, clothes, who, candy,
cousin, deaf, fine, help`.

The map is external (not embedded in the TFLite file). Index order is the
training-time class order and must never be re-sorted.

---

## 4. Preprocessing contract

`src/model/preprocess.ts` produces exactly `60 × 126 = 7,560` float32 values:

- 60 frames per clip.
- 2 hand slots per frame (anatomical left first, then right).
- 21 landmarks per hand × 3 coordinates (`x`, `y`, `z`).
- Missing hand block: 63 zeros.
- Missing frame: 126 zeros (tail padding).
- Wrist-relative normalisation per present hand, matching the training pipeline.

MediaPipe output is mapped to anatomical slots by handedness in
`useHandLandmarker.ts` / `mediapipe-adapter.ts`, not by detection order.

Unit tests: **25/25 passed** across `label-map.test.ts`,
`preprocess.test.ts`, and `liveRecognition.test.ts`.

---

## 5. Inference path in the application

1. `useHandLandmarker` initialises MediaPipe from `/wasm-vision/` and
   `/models/hand_landmarker.task` (GPU delegate first, CPU fallback).
2. `useHandRecorder` collects frames from the live camera.
3. `LiveSigningScreen` calls `landmarksToFloat32` to build the `[60,126]` clip.
4. `recogniseOnDevice` loads the model from `/model/signova_model.tflite`,
   validates input/output contract, creates a `Tensor`, runs LiteRT.js, and reads
   the `[1,2000]` float32 output.
5. Top-5 probabilities are mapped through `labels.json`; placeholder/unknown
   labels are never presented as real signs.
6. The user sees the recognised sign and must confirm or retry before a message
   is sent.

Recognition is local. Camera frames and landmark sequences are not uploaded for
inference. Only the confirmed text (plus confidence/method metadata) is sent to
the backend.

---

## 6. Verification evidence

**Environment:** Windows 11, Chromium (Playwright headless), Node 22.18, PWA
development server serving the real app modules and public assets.

Harness: `apps/web-deaf-user-pwa/workspace/model-contract.html` +
`model-contract.ts` (development-only, not included in the deployed PWA).

Observed result:

```json
{
  "inputs":  [{ "name": "landmark_sequence", "shape": [1, 60, 126], "dtype": "float32" }],
  "outputs": [{ "name": "output_0", "shape": [1, 2000], "dtype": "float32" }],
  "metadata": {
    "numClasses": 2000,
    "labelCount": 2000,
    "labelMapAuthoritative": true,
    "realLabelCount": 2000,
    "firstLabels": ["book", "drink", "computer", "before", "chair"],
    "lastLabel": "whistle"
  },
  "inference": {
    "timingMs": 39.1,
    "top1": { "sign": "fishing", "probability": 0.00277 }
  }
}
```

Notes:

- The inference uses an all-zero sequence. The prediction is meaningless and is
  **not** an accuracy result. It only proves the tensor runs and the output is
  read correctly.
- 39.1 ms is desktop Chromium WASM performance, not Android performance.
- The model loaded through LiteRT/XNNPACK without a WebGL/WebGPU requirement.

---

## 7. Required Android validation (not yet done)

On each test device:

1. Open `https://app.<SIGNOVA_DOMAIN>` and install the PWA.
2. Grant camera permission and confirm a live preview.
3. Confirm MediaPipe initialises (GPU or CPU fallback).
4. Perform a known sign from the 2,000-class vocabulary.
5. Confirm the recognised gloss is a real label, not `unknown`.
6. Confirm the confirmation screen appears before sending.
7. Confirm no network request contains video frames or landmark sequences.
8. Measure load time and inference time; record device model and Android version.
9. Test with the network disabled: model/label/task should load from cache, while
   session creation and messaging should show the offline state.
10. Repeat on a tablet in both orientations.

Suggested acceptance criteria:

| Metric | Target |
|---|---|
| Model + label load | < 5 s after app assets are installed |
| Inference on device | < 500 ms (project target) |
| Crashes during 10 consecutive signs | 0 |
| Model/label mismatch | None |
| Unconfirmed auto-send | Never |

Until this is performed, the V1 TFLite pipeline is **verified in Chromium only**,
not on the target Android hardware.

---

## 8. Model V2 boundary

- Do not modify `signova_model.tflite`, `labels.json`, or the class ordering.
- Keep Model V2 work on a separate branch and separate assets.
- Do not swap assets in the Netlify build without re-running the hash and
  contract checks above.
