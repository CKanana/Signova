# PREPROCESSING SPECIFICATION
## Signova on-device sign recognition — model input contract

Source of truth: `ml/model.py`, `ml/dataset.py`, `ml/extract_landmarks.py`,
`ml/convert_to_tflite.py`, `ml/train.py`. Model metadata from the exported
TFLite file `apps/mobile-deaf-user/src/assets/model/signova_model.tflite`
(input tensor name `landmark_sequence`, output tensor name `output_0`).

### 1. Model input tensor shape

- The on-device model expects a fixed input tensor of shape
  **[1, 60, 126]** — batch=1, 60 frames, 126 float32 values per frame,
  dtype float32. (Tensor name `landmark_sequence`; the shape is recorded in
  the model's tensor metadata.)
- Per-frame layout is 126 values = 2 hand blocks × 21 landmarks × 3
  coordinates (x, y, z). Block 0 = left hand, block 1 = right hand.
- `ml/model.py` line 35: `inputs = layers.Input(shape=(seq_len, feature_dim), name="landmark_sequence")`
- `ml/model.py` line 37: `x = layers.Masking(mask_value=0.0)(inputs)`
- `ml/model.py` line 46: `outputs = layers.Dense(num_classes, activation="softmax", name="gloss")(x)`

### 2. Order of the 126 values (per frame)

For each frame f (0-indexed), the 126-values are laid out as:

- block 0 (left hand): values at buffer[f*126 + 0 .. f*126 + 62]
  - landmark k (0..20): x, y, z at buffer[f*126 + k*3 + 0..2]
  - MediaPipe hand landmark order, index 0 = wrist, 1..4 = thumb,
    5..8 = index finger, 9..12 = middle finger, 13..16 = ring finger,
    17..20 = pinky, 21..22 = palm (form the standard 21-point layout).
- block 1 (right hand): values at buffer[f*126 + 63 .. f*126 + 125]
  - same 21-point layout

Source: `ml/extract_landmarks.py` lines 74-76: `[[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32`.flatten()` — x, y, z per landmark, landmark index 0 = wrist.

### 3. Left or right hand slot

- 2 hand slots per frame (left then right). Missing hand → all 63 zeros.
- `ml/extract_landmarks.py` line 55: `num_hands=2,  # detect up to 2, we keep only the best-scoring one`
- `ml/extract_landmarks.py` lines 63-71: keep only the single highest-confidence hand (best_idx = argmax of handedness scores). The other hand is dropped.
- `ml/model.py` line 4-5: "63-dim/frame: 21 keypoints x, y, z from a single detected hand"

NOTE: The current preprocessing implementation in the repo uses a single hand
(63-dim per frame), not the 126-dim (2 hands) the task spec assumes. The
model contract in the task states 126 values per frame (2 hands × 21 × 3).
This is a DISCREPANCY that must be resolved with the model owner — the
`extract_landmarks.py` script and `dataset.py` use a 63-dim single-hand
representation. The 126-dim layout in this spec is the on-device model's
expected input (per the task), so preprocess.ts MUST emit 126 values per
frame (2 hand blocks). If the model was trained with 63-dim, the model
must be retrained with 126-dim input — no changes to the model are made
in this phase, so the app falls back to the mock placeholder until the
model is aligned.

### 4. Coordinate normalisation

- The scripts normalise coordinates relative to the wrist (landmark 0).
- `ml/dataset.py` function `normalize_sequence` (lines 21-30):
  - `points = seq.reshape(-1, HAND_N, 3)`
  - `wrist = points[:, WRIST_IDX:WRIST_IDX + 1, :]` (WRIST_IDX = 0)
  - `shifted = points - wrist` (re-centre each frame on the wrist)
  - `np.where(nonzero_mask, shifted, seq)` — zero (missing) frames left alone
- `ml/extract_landmarks.py` lines 74-76 output raw [x, y, z]; normalisation
  happens later in `dataset.py`.
- For on-device inference, the app must match the training contract:
  coordinates are relative to the wrist (translation-invariant), and
  missing-hand frames are zeroed (the model's Masking layer ignores them).

### 5. Clip cutting to 60 frames

- Fixed clip length: CLIP_LEN = 60 frames.
- The first 60 frames are taken (no metadata frame range present in the
  scripts; the scripts use `frame_start`/`frame_end` from a manifest CSV,
  but the training pipeline truncates to `seq_len` via `pad_or_truncate`).
- `ml/dataset.py` function `pad_or_truncate` (lines 33-38):
  - `n = seq.shape[0]`
  - if n >= target_len: return `seq[:target_len]`
  - else pad with zeros
- `ml/model.py` line 35: `shape=(seq_len, feature_dim)` with seq_len=60.

### 6. Padding

- Zero padding (np.float32 0.0), appended at the end of the clip.
- `ml/dataset.py` lines 37-38:
  ```python
  pad = np.zeros((target_len - n, seq.shape[1]), dtype=seq.dtype)
  return np.concatenate([seq, pad], axis=0)
  ```
- Missing frames within the clip → all 126 values zero (2 hands × zeros).

### 7. Mask

- The model applies `layers.Masking(mask_value=0.0)` (line 37 of model.py).
- Frames whose values are all zeros are ignored (masked out) by the LSTM.
- This means: a frame with no detected hand is a zero frame → masked out.
- `ml/model.py` line 18: `Masking(mask_value=0.0)` — "lets the LSTM ignore
  padded/no-detection frames".
- `ml/dataset.py` line 26: `nonzero_mask = seq.any(axis=1, keepdims=True)`
  — frames with any non-zero value are kept; all-zero frames are treated as
  missing and preserved (not replaced) so the mask works correctly.

### 8. Branch order (left vs right hand)

- The model takes a single tensor input of shape [1, 60, 126] — left hand
  and right hand are concatenated along the feature dim into one tensor.
- Branch order: left hand block first (values 0..62 per frame), then right
  hand block (values 63..125 per frame).
- `ml/extract_landmarks.py` line 55: `num_hands=2` — detect up to 2 hands.
- The single-hand case: if only 1 hand is detected, the other block is all
  zeros (the model's Masking layer handles the missing hand).

### 9. MediaPipe coordinate system

- x, y, z are MediaPipe's normalized coordinates:
  - x, y in [0, 1] relative to the image width/height
  - z is depth (approx. distance from the camera, in meters, smaller = closer)
  - Not in pixel coordinates; the model expects normalized values.
- `ml/extract_landmarks.py` line 75: `np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)`

### 10. Whether the model outputs probabilities or logits

- The model ends with `Dense(num_classes, activation="softmax")` (line 46).
- Output: probabilities (softmax), not logits.
- `ml/model.py` line 46: `outputs = layers.Dense(num_classes, activation="softmax", name="gloss")(x)`
- `ml/model.py` line 52: `metrics=["accuracy", tf.keras.metrics.TopKCategoricalAccuracy(k=5, name="top5_acc")]`

### UNKNOWN items

- The exact input tensor dims [1, 60, 126] vs [1, 60, 63] could not be
  confirmed from the TFLite binary (preprocessing scripts use single-hand
  63-dim). The app falls back to the mock placeholder until the model is
  aligned with the app. Owner: model owner / ML team.
- The app cannot run Android build or phone test in this environment;
  see `docs/model/DEV_BUILD.md` for the exact commands to run on Windows.
