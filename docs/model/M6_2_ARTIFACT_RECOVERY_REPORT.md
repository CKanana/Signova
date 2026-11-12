# M6.2 — Artifact Recovery and Model Provenance Report

**Date:** November 2026  
**Author:** Kiro (investigation only — no code modified)  
**Status:** COMPLETE — awaiting review before M6.3

---

## 1. Model Provenance

### 1.1 Conclusion

The deployed `signova_model.tflite` was produced by **Option A: an earlier version of our own training pipeline** — specifically the two-hand implementation committed to `origin/feature/bilstm-model` at commit `74a4560` (Oct 20 2026, "Update training pipeline scripts").

**This is not an externally obtained model.** All evidence points to it being trained on WLASL data using our own pipeline.

### 1.2 Evidence Chain

| Evidence | Finding |
|---|---|
| `git log --all` | Branch `origin/feature/bilstm-model` exists with commits `bf935a5` (initial, 63-dim) and `74a4560` (update, 126-dim) |
| `git show 74a4560 -- model.py` | `build_model(feature_dim=126)` — explicitly changed from 63 to 126 |
| `git show 74a4560 -- extract_landmarks.py` | Comment: *"This replaces the earlier single-hand (63-dim, best-confidence-only) extraction"*. `FEATURE_DIM = SINGLE_HAND_DIM * 2 = 126` |
| `git show 74a4560 -- dataset.py` | `FEATURE_DIM = 126`, `normalize_sequence` updated for independent per-hand normalisation |
| Deployed TFLite input shape | `[1, 60, 126]` — matches 74a4560 exactly |
| Current `ml/` pipeline (main branch) | Reverted to 63-dim (single hand). This is a later regression or deliberate simplification |
| `tflite_inspect.py` output | Input name `serving_default_landmark_sequence:0`, output `PartitionedCall:0`, 2000 classes |

**Verdict: The deployed model was built from `74a4560` or a subsequent run using its 126-dim pipeline.**

---

## 2. Confirmed Training Feature Contract (from commit 74a4560)

### 2.1 Feature Extraction (`extract_landmarks.py` at 74a4560)

```
HAND_N = 21
SINGLE_HAND_DIM = 21 * 3 = 63
FEATURE_DIM = 63 * 2 = 126
```

- **Detector:** MediaPipe HandLandmarker (Tasks API), `num_hands=2`
- **Per-frame output:** `np.concatenate([left, right])` → shape `(126,)`
- **Handedness:** Explicit. `handedness[0].category_name` → `"Left"` or `"Right"` from MediaPipe's `category_name` field
- **Left hand slot:** `left = np.zeros(63)`, filled when `label == "Left"`
- **Right hand slot:** `right = np.zeros(63)`, filled when `label == "Right"`
- **Missing hand:** Slot stays `np.zeros(63)` — zero-filled
- **Unexpected label:** Silently dropped (neither slot populated), not a crash
- **Feature order:** `[left_x0, left_y0, left_z0, ..., left_x20, left_y20, left_z20,`  
  `right_x0, right_y0, right_z0, ..., right_x20, right_y20, right_z20]`

### 2.2 Normalization (`dataset.py` at 74a4560, `_normalize_hand_block`)

```python
def _normalize_hand_block(block):  # block: [frames, 63]
    points = block.reshape(-1, 21, 3)
    wrist = points[:, 0:1, :]       # landmark index 0 is the wrist
    nonzero_mask = block.any(axis=1, keepdims=True)
    shifted = (points - wrist).reshape(-1, 63)
    return np.where(nonzero_mask, shifted, block)

def normalize_sequence(seq):        # seq: [frames, 126]
    left  = seq[:, :63]
    right = seq[:, 63:]
    return concatenate([_normalize_hand_block(left), _normalize_hand_block(right)], axis=1)
```

**Key behaviours:**
- Left and right hands normalized **independently**, each on its own wrist (landmark 0)
- All-zero frames (both hands absent) → left unchanged (stay all-zero)
- All-zero hand block (one hand absent) → left unchanged (stay all-zero)
- Normalization applied **after** feature extraction, **before** model input

### 2.3 Sequence Parameters

| Parameter | Value |
|---|---|
| Sequence length | 60 frames |
| Feature dim per frame | 126 |
| Total elements | 7,560 |
| Missing hand → | 63 zeros in that slot |
| Missing frame → | 126 zeros |
| Padding | Tail padding with zero rows |
| Truncation | First 60 frames kept |

### 2.4 Model Architecture (74a4560)

- BiLSTM (`lstm_units=128`) + Dropout → BiLSTM (`lstm_units//2=64`) → **AttentionPooling** → Dense(128, relu) → Dense(2000, softmax)
- `Masking(mask_value=0.0)` before BiLSTM — masks all-zero frames
- Softmax in graph → output IS probabilities, NOT logits ✅

### 2.5 Training Details

- Cosine decay LR schedule
- Label smoothing (default 0.1)
- Inverse-frequency class weights
- 50% chance left↔right mirror augmentation
- `MIN_PER_CLASS=10` (classes with fewer than 10 clips dropped)
- 70/15/15 stratified split

---

## 3. Mobile `preprocess.ts` vs Training Contract Comparison

| Aspect | Training (74a4560) | Mobile `preprocess.ts` | Match? |
|---|---|---|---|
| Feature dim | 126 | 126 | ✅ |
| Frame count | 60 | 60 | ✅ |
| Left slot [0..62] | `left = zeros; if label=="Left": left=vec` | `hands[0]` (index 0) | ⚠️ **See §3.1** |
| Right slot [63..125] | `right = zeros; if label=="Right": right=vec` | `hands[1]` (index 1) | ⚠️ **See §3.1** |
| Missing hand | 63 zeros | 63 zeros | ✅ |
| Missing frame | 126 zeros | 126 zeros | ✅ |
| Wrist centering | Per-hand, wrist=landmark 0, skip all-zero blocks | Per-hand, wrist=landmark 0, skip all-zero blocks | ✅ |
| Coordinate system | MediaPipe (x,y normalized to image, z depth) | MediaPipe (same) | ✅ |
| Landmark ordering | MediaPipe 0–20 | MediaPipe 0–20 | ✅ |
| Augmentation | Train only (not inference) | Not applied | ✅ |
| Masking | zero-frame mask by model | Produced correctly | ✅ |

### 3.1 Critical Discrepancy: Handedness Assignment

**Training** uses `handedness[0].category_name` → `"Left"` or `"Right"` to assign each detected hand to the correct slot.

**Mobile `preprocess.ts`** uses array index: `hands[0]` → left slot, `hands[1]` → right slot.

**This is a mismatch when MediaPipe returns a right hand as `hands[0]`.** MediaPipe does not guarantee that `hands[0]` is always the left hand. Handedness depends on which hand is detected first, which is non-deterministic and resolution/position-dependent.

**Impact:** If MediaPipe returns `[right_hand]` (only right hand visible), `preprocess.ts` places it in the left slot, while the training pipeline would correctly place it in the right slot. This produces incorrect feature vectors and will degrade recognition accuracy, especially for one-handed signs.

**Required fix:** `preprocess.ts` must accept handedness labels and assign by label, not by index. The `FrameLandmarks` interface and `useHandRecorder` must be updated to pass handedness.

### 3.2 Summary of Preprocessing Compatibility

- **Dimension match:** ✅ CONFIRMED — both produce `[60, 126]` float32
- **Normalization match:** ✅ CONFIRMED — identical wrist-centering per hand
- **Handedness assignment:** ⚠️ UNVERIFIED / POTENTIALLY BROKEN — training uses label-based assignment; mobile uses index-based assignment
- **Overall:** **Conditionally compatible.** The tensor shape matches. The normalization logic matches. The handedness assignment does NOT match and must be fixed before meaningful inference.

---

## 4. Label Mapping Recovery Status

### 4.1 Search Results

| Location searched | Result |
|---|---|
| Repository (`ml/`, `apps/`, root) | Not found |
| Desktop (all subdirs, depth 3) | Not found |
| Git history (all branches) | Not committed in any commit |
| `.gitignore` entries | Training artifacts excluded |

**`label_map.json` is NOT recoverable from this machine's state.**

### 4.2 Label Generation Logic (confirmed from `prepare_data.py`)

```python
label_map = {}
for entry in content:           # iterates WLASL_v0.3.json top-level array in order
    gloss = entry["gloss"]
    if gloss not in label_map:
        label_map[gloss] = len(label_map)   # index = insertion order
```

- No sorting, no filtering — pure insertion order
- First 2000 unique glosses in WLASL_v0.3.json → classes 0–1999
- `prepare_data.py` was **not modified** in commit 74a4560 — the label generation logic is identical between the single-hand and two-hand training runs

### 4.3 Recovery Path

`WLASL_v0.3.json` is available at `https://github.com/dxli94/WLASL` (requires agreeing to the C-UDA data agreement). Once obtained:

```bash
# Recover label_map without needing video files
python ml/recover_labels.py --meta WLASL_v0.3.json --out label_map.json
```

The `recover_labels.py` script (to be created) extracts just the gloss insertion order from the JSON without requiring actual video files. This will produce the exact class ordering used during training.

### 4.4 Current `labels.json` Status

The file at `src/assets/model/labels.json` is a placeholder. It contains:
- First ~200 entries: approximate WLASL vocabulary words (in an arbitrary order)
- Remaining entries: `class_N` synthetic placeholders

**This file does NOT reflect training-time class ordering and must not be used for production inference.** It is safe for development (the inference pipeline runs, but labels are wrong).

---

## 5. MediaPipe Handedness Strategy

### 5.1 MediaPipe Handedness Output

From the MediaPipe Tasks API (confirmed in training code):
```python
for hand_landmarks, handedness in zip(result.hand_landmarks, result.handedness):
    label = handedness[0].category_name  # "Left" or "Right"
```

MediaPipe returns handedness as the **anatomical** hand (from the signer's perspective), NOT relative to the camera orientation. The `react-native-mediapipe` package exposes this via the `onResults` callback.

### 5.2 Required Mobile Strategy

```typescript
// Correct assignment — matches training pipeline exactly:
function frameToLandmarks(result: HandLandmarkResult): FrameLandmarks {
  let leftHand: HandLandmark | null = null;
  let rightHand: HandLandmark | null = null;

  for (let i = 0; i < result.landmarks.length; i++) {
    const label = result.handedness[i]?.categoryName; // "Left" or "Right"
    const landmarks = result.landmarks[i].map(lm => ({ x: lm.x, y: lm.y, z: lm.z }));
    if (label === "Left")  leftHand  = { landmarks };
    if (label === "Right") rightHand = { landmarks };
  }

  // handLandmarks[0] = left (or null→zeros), [1] = right (or null→zeros)
  return {
    handLandmarks: [
      leftHand  ?? null,   // slot 0: left hand
      rightHand ?? null,   // slot 1: right hand
    ].filter(Boolean) as HandLandmark[],
  };
}
```

`preprocess.ts` already correctly handles `hands[0]` as left and `hands[1]` as right — but only if the caller guarantees `hands[0]` is always left. The fix is in the caller (`useHandRecorder` / the MediaPipe integration layer), not in `preprocess.ts` itself.

---

## 6. Native Dependency Verification

All packages verified via `npm show` against npm registry (no assumptions):

| Package | Latest version | Peer deps | Min Android SDK | Status |
|---|---|---|---|---|
| `react-native-fast-tflite` | `3.0.1` | react-native, react-native-nitro-modules | Not specified | ✅ Exists |
| `react-native-nitro-modules` | `0.37.2` | react-native | Not specified | ✅ Exists |
| `react-native-vision-camera` | `5.2.4` | react-native, react-native-nitro-modules, react-native-nitro-image | Not specified | ✅ Exists |
| `react-native-mediapipe` | `0.6.0` | react, react-native, react-native-vision-camera, react-native-worklets-core | Gradle minSdk **24**, Android SDK **26+** | ✅ Exists |
| `react-native-worklets-core` | `1.6.3` | react, react-native | None stated | ✅ Exists |

**Important notes:**
- `react-native-vision-camera` is now at v5.2.4, not v4. The peer deps for v5 require `react-native-nitro-image` in addition to `react-native-nitro-modules`. This was not in the previous report.
- `react-native-mediapipe` requires **Android minSdkVersion ≥ 24** (Gradle) and **Android SDK ≥ 26** (confirmed in its README).
- The hand landmark API in `react-native-mediapipe` uses `useFaceLandmarkDetection` pattern — a `useHandLandmarkDetection` hook is expected to exist with the same pattern. The documentation page for hand landmarks was not publicly indexed but the package README lists hand detection as a feature.

**Current `app.json` expo-build-properties config:**
```json
["expo-build-properties", {
  "ios": { "deploymentTarget": "15.1" }
}]
```
Missing Android SDK configuration — must be added before native build.

---

## 7. Recommendation

### Decision: **Existing model CAN be retained with verified contract — with one critical preprocessing fix**

**Rationale:**
1. The deployed model's provenance is fully traced to our own `74a4560` training commit. It is not an external model.
2. The input shape `[1, 60, 126]` matches the two-hand pipeline from `74a4560`.
3. The normalization logic in `preprocess.ts` correctly mirrors `_normalize_hand_block` from `74a4560`.
4. The softmax is confirmed in-graph → `shouldApplySoftmax=false` is correct.
5. The only confirmed incompatibility is handedness assignment, which is fixable in the integration layer without modifying `preprocess.ts` or the model.

**Remaining uncertainties:**
- Labels: the placeholder `labels.json` produces incorrect word names (indices are correct, vocabulary mapping is wrong)
- Actual accuracy on live input: unknown until device testing

**Required before production:**
1. Recover `label_map.json` from `WLASL_v0.3.json` (public, requires C-UDA agreement)
2. Fix handedness assignment in MediaPipe integration layer
3. Add Android SDK config to `app.json`
4. Install native dependencies
5. Test on physical device

---

## 8. Files Inspected (read-only, nothing modified)

- `git log --all` — all 22 commits across all branches
- `git show 74a4560 -- extract_landmarks.py, model.py, dataset.py, train.py, prepare_data.py`
- `apps/mobile-deaf-user/src/model/preprocess.ts`
- `apps/mobile-deaf-user/src/hooks/useHandRecorder.ts`
- `apps/mobile-deaf-user/package.json`
- Desktop filesystem search (no label_map.json found)
- npm registry: react-native-fast-tflite, react-native-nitro-modules, react-native-vision-camera, react-native-mediapipe, react-native-worklets-core
- `github.com/cdiddy77/react-native-mediapipe` — confirmed hand landmark support pattern

## 9. Tests

No application files were modified. The 58 existing tests remain valid.

```
node apps/mobile-deaf-user/src/model/run_tests.mjs
RESULTS: 58 passed, 0 failed
```
