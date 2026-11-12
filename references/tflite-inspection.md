# TFLite binary inspection without TensorFlow or pip

M4b on-device sign recognition requires reading the *actual* input tensor
shape from the `.tflite` flatbuffer binary. The repo's training code assumes
a single 63-dim hand (`ml/model.py`, `ml/dataset.py`, `extract_landmarks.py`
all use `FEATURE_DIM = 63`), but the task spec states `[1, 60, 126]`. The
app must match the real model, not the spec or the scripts alone. Before
finalising `preprocess.ts`, resolve the actual tensor shape from the binary.

## First, confirm the assets exist and where

- A repo-wide `find` for `labels.json`, `model_info.json`, `model_fixtures.json`
  may return **no matches** — the files can be entirely absent from the tree.
  Do not silently assume they exist; report the absence as a blocker.
- Confirm the `.tflite` presence and its path. The file lands at
  `apps/mobile-deaf-user/src/assets/model/signova_model.tflite` (1,332,256
  bytes) and is the only model asset present.

## Why: no TF / no pip available

Installing TensorFlow or the `tflite` Python package needs `pip` (or a full
environment). On this host the Python venv has no `pip` and no TF/tflite
package. A custom flatbuffer parser that reads the TFLite header and walks
the table/offsets must therefore be written in plain Python (`struct`).

## The working technique (plain Python, no third-party deps)

1. Read the whole file into memory (`data = open(path,'rb').read()`).
2. The file header is 28 bytes: magic `'TFL3'` (4), pad (4), version (4),
   total_len (4), ctx_count (4), root_offset (4).
3. The flatbuffer **root** is at `root_offset` (relative to the file start, not
   the buffer). At `root + 4` is the vtable pointer (relative offset from
   `root`), so the vtable lives at `root + 4 + vtable_ptr`.
4. The **Model** struct (root itself) has fields: `num_subgraphs`, `num_tensors`,
   `num_ops`, …, `tensors` (offset 24), `input_tensors` (offset 28),
   `output_tensors` (offset 32). Read them as `<H` (uint16) for the count
   fields and `<I` (uint32) offsets for the pointer fields.
5. The **TensorArray** is a flatbuffer table: at `table_start + 0` a uint64
   (unused), at `table_start + 8` an int32 pointer to the array of tensor
   offsets, at `table_start + 16` a uint32 `num_tensors`.
6. Each tensor offset is a `<I` relative offset into the data region `base +
   offset`, where `base = root + 4 + data_ptr`.
7. Inside a **Tensor** struct (offset within the tensor table data):
   - `name_offset` at `+32` (uint32, relative to tensor table start)
   - `version` at `+36` (int32)
   - `subgraph` pointer at `+40` (int32)
   - `type` at `+44` (uint8, TensorType)
   - `quantization` fields at `+48` (8 bytes)
   - `dims` vector at `+56` (uint32 offset to the vector data, which is
     `4-byte count` followed by the int64 values, i.e. count then count*8
     bytes of `<q` values)
   - `name` string at `+64` (uint32 offset to the string data, which is
     `1-byte length` then the bytes)
8. For the **input** tensor (typically index 0, name `landmark_sequence`) and
   the **output** tensor (typically index 28, name `output_0`), read the full
   `dims` array and print it. Confirm the shape of each dimension: batch,
   time/frames, features.

## Pitfalls

- The flatbuffer root is not necessarily at file offset 0 — it is at
  `root_offset` from the file start. Reading from offset 16 or 20 produces
  garbage (vtable_size, field offsets, and tensor dims all become nonsense).
- Vtable entries and tensor offsets are **relative** to the table/data
  region, not absolute file offsets. Add `table_start` before dereferencing.
- The string data for `name` and vector lengths are stored with different
  alignments than the surrounding struct — read them with their own
  `<I`/`<B` reads, not as part of the struct.
- An incorrect interpretation of the Tensor struct layout (e.g. reading
  `dims` as a varint array instead of a vector offset) silently yields
  plausible-looking but wrong numbers. Cross-check by printing the tensor
  **name** from `name_offset` alongside the dims — a name mismatch reveals
  the layout is wrong.
- Do not infer dims from the training scripts alone (as the spec note warns).
  The 63-dim scripts and the `[1,60,126]` spec can both be wrong; the binary
  is authoritative. Only a confirmed binary shape licenses the app's
  `preprocess.ts` output shape.

## When the shape still cannot be resolved

Mark the blocker explicitly: `preprocess.ts` emits the spec's 126 values/frame
(two-hand blocks) but the model input is unconfirmed. Do not claim the
preprocessor is contract-matched to the model. Report `COULD-NOT-CHECK` and
ask the user for the tensor shape (e.g. from the trained model owner) or for a
TF/tflite install.

## Verification

Re-run the parser against the binary and print each tensor name + dims.
Confirmed output (not a guess): input tensor name, output tensor name, and
each dim on every axis.
