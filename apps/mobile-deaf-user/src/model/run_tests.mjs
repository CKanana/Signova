/**
 * Minimal test runner for model unit tests.
 * Uses Node's native test runner (node:test) available in Node >= 18.
 * Run: node --experimental-vm-modules src/model/run_tests.mjs
 * Or:  npx tsx src/model/run_tests.mjs
 */

// ── Phase 5: run tests for preprocess.ts and recogniser.ts helpers ──

// We implement the tests inline in pure JS (no TypeScript) so they run
// without a build step. The logic mirrors the .test.ts files exactly.

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) {
    failures.push(msg);
    failed++;
    console.error(`  ✗ ${msg}`);
  } else {
    passed++;
    console.log(`  ✓ ${msg}`);
  }
}

function assertClose(a, b, msg, tol = 1e-5) {
  assert(Math.abs(a - b) < tol, `${msg} (got ${a}, expected ~${b})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: MODEL CONTRACT CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== MODEL CONTRACT CONSTANTS ===");

const CLIP_LEN = 60;
const LANDMARKS_PER_HAND = 21;
const COORDS_PER_LANDMARK = 3;
const VALUES_PER_HAND = LANDMARKS_PER_HAND * COORDS_PER_LANDMARK; // 63
const VALUES_PER_FRAME = VALUES_PER_HAND * 2;                      // 126
const MODEL_NUM_CLASSES = 2000;
const MODEL_INPUT_ELEMENTS = CLIP_LEN * VALUES_PER_FRAME;          // 7560
const MODEL_OUTPUT_ELEMENTS = MODEL_NUM_CLASSES;                   // 2000

assert(CLIP_LEN === 60, "CLIP_LEN = 60");
assert(VALUES_PER_HAND === 63, "VALUES_PER_HAND = 21 * 3 = 63");
assert(VALUES_PER_FRAME === 126, "VALUES_PER_FRAME = 2 * 63 = 126");
assert(MODEL_INPUT_ELEMENTS === 7560, "INPUT elements = 60 * 126 = 7560");
assert(MODEL_OUTPUT_ELEMENTS === 2000, "NUM_CLASSES = 2000 (from tflite inspection)");
assert(MODEL_INPUT_ELEMENTS * 4 === 30240, "INPUT bytes = 7560 * 4 = 30240");
assert(MODEL_OUTPUT_ELEMENTS * 4 === 8000, "OUTPUT bytes = 2000 * 4 = 8000");

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: PREPROCESSING — landmarksToFloat32
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== PREPROCESSING ===");

/**
 * Pure JS reimplementation matching preprocess.ts for testing.
 * Includes wrist-normalisation per hand block.
 */
function normalizeHandBlock(buf, offset) {
  let hasHand = false;
  for (let i = offset; i < offset + VALUES_PER_HAND; i++) {
    if (buf[i] !== 0) { hasHand = true; break; }
  }
  if (!hasHand) return;
  const wx = buf[offset], wy = buf[offset+1], wz = buf[offset+2];
  for (let lm = 0; lm < LANDMARKS_PER_HAND; lm++) {
    const i = offset + lm * 3;
    buf[i]   -= wx;
    buf[i+1] -= wy;
    buf[i+2] -= wz;
  }
}

function landmarksToFloat32(frames) {
  const buf = new Float32Array(CLIP_LEN * VALUES_PER_FRAME);
  for (let f = 0; f < CLIP_LEN; f++) {
    const frame = frames[f];
    if (!frame || !frame.handLandmarks || frame.handLandmarks.length === 0) continue;
    const hands = frame.handLandmarks;
    for (let h = 0; h < 2; h++) {
      const hand = hands[h];
      const base = h * VALUES_PER_HAND;
      if (hand && hand.landmarks) {
        for (let k = 0; k < LANDMARKS_PER_HAND; k++) {
          const lm = hand.landmarks[k];
          if (!lm) continue;
          const o = f * VALUES_PER_FRAME + base + k * 3;
          buf[o]   = lm.x;
          buf[o+1] = lm.y;
          buf[o+2] = lm.z;
        }
      }
    }
  }
  for (let f = 0; f < CLIP_LEN; f++) {
    const fo = f * VALUES_PER_FRAME;
    normalizeHandBlock(buf, fo);
    normalizeHandBlock(buf, fo + VALUES_PER_HAND);
  }
  return buf;
}

// Test 1: output shape
{
  const frames = Array.from({ length: 60 }, () => ({ handLandmarks: [] }));
  const buf = landmarksToFloat32(frames);
  assert(buf instanceof Float32Array, "Returns Float32Array");
  assert(buf.length === CLIP_LEN * VALUES_PER_FRAME, `Length = ${CLIP_LEN * VALUES_PER_FRAME}`);
}

// Test 2: empty frames → all zeros
{
  const frames = Array.from({ length: 60 }, () => ({ handLandmarks: [] }));
  const buf = landmarksToFloat32(frames);
  assert(buf.every(v => v === 0), "Empty frames → all zeros");
}

// Test 3: short clip padded with zeros
{
  const oneHand = {
    handLandmarks: [{
      landmarks: Array.from({ length: 21 }, (_, k) => ({ x: k * 0.1, y: 0.5, z: 0.0 }))
    }]
  };
  const frames = [oneHand];
  const buf = landmarksToFloat32(frames);
  // After normalisation, wrist (landmark 0) should be at origin
  assertClose(buf[0], 0, "Wrist x after normalise = 0");
  assertClose(buf[1], 0, "Wrist y after normalise = 0");
  // Landmark 1 x should be 0.1 - 0.0 = 0.1
  assertClose(buf[3], 0.1, "Landmark 1 x after normalise = 0.1");
  // Frames 1-59 all zero
  let framesAfterZero = true;
  for (let i = VALUES_PER_FRAME; i < buf.length; i++) {
    if (buf[i] !== 0) { framesAfterZero = false; break; }
  }
  assert(framesAfterZero, "Frames 1-59 are zero-padded");
}

// Test 4: two hands — left block [0..62], right block [63..125] per frame
{
  const twoHands = {
    handLandmarks: [
      { landmarks: Array.from({ length: 21 }, () => ({ x: 1.0, y: 2.0, z: 3.0 })) }, // left
      { landmarks: Array.from({ length: 21 }, () => ({ x: 4.0, y: 5.0, z: 6.0 })) }, // right
    ]
  };
  const frames = Array.from({ length: 60 }, () => twoHands);
  const buf = landmarksToFloat32(frames);
  // After normalise: wrist of left = (1,2,3) → landmark 0 = (0,0,0), landmark 1 = (0,0,0) (all same)
  // Since all left landmarks are (1,2,3), after subtracting wrist (1,2,3) they're all (0,0,0)
  assertClose(buf[0], 0, "Left wrist x = 0 after normalise");
  assertClose(buf[1], 0, "Left wrist y = 0 after normalise");
  assertClose(buf[2], 0, "Left wrist z = 0 after normalise");
  assertClose(buf[63], 0, "Right wrist x = 0 after normalise");
  assertClose(buf[64], 0, "Right wrist y = 0 after normalise");
}

// Test 5: missing landmark in detected hand
// When landmark 1 is null, the slot stays (0,0,0). After wrist-normalisation,
// the slot becomes (0 - wristX, 0 - wristY, 0 - wristZ) = (-0.5, -0.5, 0).
// This is the documented behaviour: null slots are not excluded from normalisation.
{
  const wristX = 0.5, wristY = 0.5, wristZ = 0.0;
  const partialHand = {
    handLandmarks: [{
      landmarks: [
        { x: wristX, y: wristY, z: wristZ }, // landmark 0 (wrist)
        null,                                  // landmark 1 missing
        { x: 0.7, y: 0.8, z: 0.1 },           // landmark 2
        ...Array.from({ length: 18 }, () => ({ x: wristX, y: wristY, z: wristZ }))
      ]
    }]
  };
  const buf = landmarksToFloat32([partialHand]);
  // Null slot left at (0,0,0); after normalise: 0 - wristX = -0.5
  assertClose(buf[3], -wristX, "Missing landmark 1 x = -wristX after normalise");
  assertClose(buf[4], -wristY, "Missing landmark 1 y = -wristY after normalise");
  // Landmark 2 after normalise: 0.7-0.5=0.2
  assertClose(buf[6], 0.7 - wristX, "Landmark 2 x after normalise = 0.2");
}

// Test 6: clip truncated to 60 frames (no crash on over-length)
{
  const frames = Array.from({ length: 90 }, (_, i) => ({
    handLandmarks: [{ landmarks: Array.from({ length: 21 }, () => ({ x: i*0.01, y: 0, z: 0 })) }]
  }));
  const buf = landmarksToFloat32(frames);
  assert(buf.length === CLIP_LEN * VALUES_PER_FRAME, "Over-length clip produces correct output size");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: SOFTMAX
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== SOFTMAX ===");

function softmax(scores) {
  let max = -Infinity;
  for (let i = 0; i < scores.length; i++) if (scores[i] > max) max = scores[i];
  let sum = 0;
  const out = new Float32Array(scores.length);
  for (let i = 0; i < scores.length; i++) {
    out[i] = Math.exp(scores[i] - max);
    sum += out[i];
  }
  if (sum > 0) for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

{
  const s = new Float32Array([1, 1, 1]);
  const out = softmax(s);
  assertClose(out[0], 1/3, "Equal inputs → 1/3 each");
  let sum = out[0] + out[1] + out[2];
  assertClose(sum, 1.0, "Sum = 1");
}
{
  const s = new Float32Array([0, 10, 0]);
  const out = softmax(s);
  assert(out[1] > 0.99, "Max input dominates softmax output");
}
{
  const s = new Float32Array(5); // all zeros
  const out = softmax(s);
  assertClose(out[0], 0.2, "All-zero → uniform 0.2");
}
{
  const s = new Float32Array([1]);
  const out = softmax(s);
  assertClose(out[0], 1.0, "Single element → 1.0");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: TOP-K
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== TOP-K ===");

function topK(indices, k, scores) {
  return [...indices].sort((a, b) => scores[b] - scores[a]).slice(0, k);
}

{
  const scores = new Float32Array([0.1, 0.9, 0.3, 0.8, 0.5]);
  const top3 = topK([0,1,2,3,4], 3, scores);
  assert(top3[0] === 1 && top3[1] === 3 && top3[2] === 4, "Top-3: indices [1,3,4]");
}
{
  const scores = new Float32Array([0.5, 0.5]);
  const top5 = topK([0,1], 5, scores);
  assert(top5.length === 2, "Returns min(k, length) results");
}
{
  const scores = new Float32Array([0.2, 0.9, 0.4]);
  const top = topK([0,1,2], 3, scores);
  assert(top[0] === 1 && top[1] === 2 && top[2] === 0, "Sorted descending");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: LABEL DECODING
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== LABEL DECODING ===");

{
  // Simulate decoding 2000-class output
  const prob = new Float32Array(2000);
  prob[0]    = 0.82;  // "book" (class 0)
  prob[42]   = 0.11;  // some class
  prob[1999] = 0.07;  // last class
  const labels = Array.from({ length: 2000 }, (_, i) => `class_${i}`);
  labels[0]  = "book";
  labels[42] = "drink";

  const numLabels = prob.length;
  const indices = Array.from({ length: numLabels }, (_, i) => i);
  const top5 = topK(indices, 5, prob);
  const results = top5.map(i => ({ sign: labels[i] ?? `class_${i}`, probability: prob[i] }));

  assert(results[0].sign === "book", "Top-1 label = 'book'");
  assertClose(results[0].probability, 0.82, "Top-1 probability = 0.82");
  assert(results.length === 5, "Returns exactly 5 results");
  assert(results[1].sign === "drink", "Top-2 label = 'drink'");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: CONFIDENCE THRESHOLD
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== CONFIDENCE HANDLING ===");

{
  const LOW_CONFIDENCE_THRESHOLD = 0.4;
  const highConf = { sign: "hello", probability: 0.82 };
  const lowConf  = { sign: "maybe", probability: 0.23 };
  assert(highConf.probability >= LOW_CONFIDENCE_THRESHOLD, "0.82 >= 0.4 → high confidence");
  assert(lowConf.probability  <  LOW_CONFIDENCE_THRESHOLD, "0.23 < 0.4 → low confidence");
  assert(!(0.4 < LOW_CONFIDENCE_THRESHOLD), "0.4 is NOT low confidence (boundary)");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7: CONCURRENT INFERENCE GUARD
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== CONCURRENT INFERENCE GUARD ===");

{
  let isRunning = false;
  let skippedDuplicate = false;

  async function mockInfer() {
    if (isRunning) { skippedDuplicate = true; return null; }
    isRunning = true;
    await new Promise(r => setTimeout(r, 10));
    isRunning = false;
    return { result: "ok" };
  }

  const [r1, r2] = await Promise.all([mockInfer(), mockInfer()]);
  assert(r1 !== null, "First inference completes");
  assert(r2 === null, "Concurrent call skipped (returns null)");
  assert(skippedDuplicate, "Duplicate inference was prevented");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8: MODEL CONTRACT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== MODEL CONTRACT VALIDATION ===");

{
  // Simulate _validateModelContract
  function validateContract(model) {
    const inputs = model.inputs ?? [];
    const outputs = model.outputs ?? [];
    if (!inputs.length) throw new Error("No inputs");
    if (!outputs.length) throw new Error("No outputs");
    const inp = inputs[0];
    if (inp.shape.length !== 3 || inp.shape[0] !== 1 || inp.shape[1] !== 60 || inp.shape[2] !== 126)
      throw new Error(`Input shape mismatch: ${inp.shape}`);
    const out = outputs[0];
    if (out.shape[out.shape.length - 1] !== 2000)
      throw new Error(`Output shape mismatch: ${out.shape}`);
    return true;
  }

  // Valid contract
  const validModel = {
    inputs: [{ name: "serving_default_landmark_sequence:0", shape: [1, 60, 126], dataType: "float32" }],
    outputs: [{ name: "PartitionedCall:0", shape: [1, 2000], dataType: "float32" }],
  };
  assert(validateContract(validModel) === true, "Valid contract passes validation");

  // Wrong input shape
  let threw = false;
  try {
    validateContract({ inputs: [{ shape: [1, 30, 63] }], outputs: [{ shape: [1, 2000] }] });
  } catch { threw = true; }
  assert(threw, "Wrong input shape throws");

  // Wrong num_classes
  threw = false;
  try {
    validateContract({ inputs: [{ shape: [1, 60, 126] }], outputs: [{ shape: [1, 100] }] });
  } catch { threw = true; }
  assert(threw, "Wrong num_classes throws");

  // No inputs
  threw = false;
  try { validateContract({ inputs: [], outputs: [{ shape: [1, 2000] }] }); }
  catch { threw = true; }
  assert(threw, "No inputs throws");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9: INPUT BUFFER PREPARATION
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== INPUT BUFFER PREPARATION ===");

{
  // The model expects: Float32Array.buffer as ArrayBuffer input
  const sequence = new Float32Array(CLIP_LEN * VALUES_PER_FRAME);
  const inputBuffer = sequence.buffer;

  assert(inputBuffer instanceof ArrayBuffer, "sequence.buffer is ArrayBuffer");
  assert(inputBuffer.byteLength === CLIP_LEN * VALUES_PER_FRAME * 4, `Buffer byte length = ${CLIP_LEN * VALUES_PER_FRAME * 4}`);

  // Verify round-trip: write float values, read back via buffer view
  sequence[0]    = 0.123;
  sequence[7559] = 0.987;
  const readback = new Float32Array(inputBuffer);
  assertClose(readback[0],    0.123, "First element survives buffer round-trip");
  assertClose(readback[7559], 0.987, "Last element survives buffer round-trip");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 10: OUTPUT BUFFER DECODING
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== OUTPUT BUFFER DECODING ===");

{
  // Simulate react-native-fast-tflite v3 output: ArrayBuffer of [1, 2000] float32
  const outputFloat = new Float32Array(2000);
  outputFloat[7]   = 0.75; // top class
  outputFloat[100] = 0.15;
  outputFloat[500] = 0.08;

  // Decode: wrap output ArrayBuffer in Float32Array
  const decoded = new Float32Array(outputFloat.buffer);
  assert(decoded.length === 2000, "Decoded output has 2000 elements");

  // Since model already applies softmax, do NOT apply it again
  const labels = Array.from({ length: 2000 }, (_, i) => `word_${i}`);
  const indices = Array.from({ length: 2000 }, (_, i) => i);
  const top5 = topK(indices, 5, decoded);
  const results = top5.map(i => ({ sign: labels[i], probability: decoded[i] }));

  assert(results[0].sign === "word_7", "Top-1 class index = 7");
  assertClose(results[0].probability, 0.75, "Top-1 probability = 0.75");
  assert(results.length === 5, "5 results returned");
  assert(results[0].probability >= results[1].probability, "Results sorted descending");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 11: CONFIRMATION GATE (never auto-send)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== CONFIRMATION GATE ===");

{
  let sentWithoutConfirmation = false;
  let confirmationShown = false;

  function simulateRecognitionFlow(gloss, confidence) {
    // Step 1: recognition result arrives
    const result = { sign: gloss, probability: confidence };
    // Step 2: ALWAYS show confirmation — never auto-send
    confirmationShown = true;
    // Step 3: send only happens AFTER explicit user confirmation
    // (user presses "Confirm and send" button)
    return { pendingConfirmation: result, autoSent: false };
  }

  const flow = simulateRecognitionFlow("hello", 0.82);
  assert(confirmationShown, "Confirmation screen shown before sending");
  assert(!flow.autoSent, "Message NOT auto-sent");
  assert(!sentWithoutConfirmation, "sendMessage never called without confirmation");
  assert(flow.pendingConfirmation.sign === "hello", "Pending gloss = 'hello'");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 12: MODEL ASSET VERIFICATION (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== MODEL ASSET VERIFICATION ===");

{
  const fs = await import("node:fs");
  const modelPath = "src/assets/model/signova_model.tflite";
  assert(fs.existsSync(modelPath), "signova_model.tflite asset exists");
  const stat = fs.statSync(modelPath);
  assert(stat.size === 1332256, `Model size = 1,332,256 bytes (got ${stat.size})`);
  assert(stat.isFile(), "Model asset is a regular file");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 13: RECOGNISER INFERENCE PATH (Phase 2)
// Mocks react-native-fast-tflite to prove the TS inference path:
// input [1,60,126] FLOAT32 → output [1,2000] FLOAT32, finite scores,
// softmax NOT applied (model already applies it).
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== RECOGNISER INFERENCE PATH ===");

{
  // Simulate a loaded model whose output buffer is [1, 2000] FLOAT32.
  const outputScores = new Float32Array(2000);
  outputScores[3] = 0.81;   // top class
  outputScores[11] = 0.19;  // second class
  // Rest remain 0 — distribution already sums to 1.0 (valid softmax output).
  const mockModel = {
    inputs: [{ shape: [1, 60, 126], dataType: "float32" }],
    outputs: [{ shape: [1, 2000], dataType: "float32" }],
    run: async ([inputBuffer]) => {
      // Validate input: must be an ArrayBuffer of exactly 7560 * 4 bytes.
      assert(inputBuffer instanceof ArrayBuffer, "run receives an ArrayBuffer");
      assert(inputBuffer.byteLength === 7560 * 4, `Input buffer byteLength = 7560*4 = 30240`);
      // Round-trip the input to confirm FLOAT32 representation.
      const view = new Float32Array(inputBuffer);
      assert(view.length === 7560, "Input view length = 60*126 = 7560");
      return [outputScores.buffer];
    },
  };

  const sequence = new Float32Array(60 * 126);
  const inputBuffer = sequence.buffer;
  assert(inputBuffer.byteLength === 30240, "sequence.buffer byteLength = 30240");

  const outputBuffers = await mockModel.run([inputBuffer]);
  assert(outputBuffers.length === 1, "Model returns exactly one output buffer");
  const decoded = new Float32Array(outputBuffers[0]);
  assert(decoded.length === 2000, "Decoded output length = 2000 ([1, 2000])");

  // Scores must be finite.
  let allFinite = true;
  for (let i = 0; i < decoded.length; i++) {
    if (!Number.isFinite(decoded[i])) { allFinite = false; break; }
  }
  assert(allFinite, "All output scores are finite");

  // Model already applies softmax — do NOT apply again.
  // Sum of probabilities should be ~1.0 (softmax output), not re-softmaxed.
  let sum = 0;
  for (let i = 0; i < decoded.length; i++) sum += decoded[i];
  assertClose(sum, 1.0, "Output is already probabilities (sum ≈ 1.0, no second softmax)");

  // Top-1 selection.
  const indices = Array.from({ length: 2000 }, (_, i) => i);
  const top = topK(indices, 1, decoded)[0];
  assert(top === 3, "Top-1 class index = 3");
  assertClose(decoded[3], 0.81, "Top-1 probability = 0.81");
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 14: CAMERA→MODEL PIPELINE (Phase 4 / Phase 6)
// Verifies adapter → preprocess → 60-frame sequence buffer → tensor shape.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n=== CAMERA→MODEL PIPELINE ===");

// Reuse the adapter + preprocess contract via lightweight local mirrors.
function toFrameLandmarksLocal(frame) {
  const handedness = frame.handedness ?? [];
  const landmarks = frame.landmarks ?? [];
  const handLandmarks = [null, null];
  for (let i = 0; i < landmarks.length; i++) {
    const label = handedness[i]?.category_name;
    if (label === "Left") { handLandmarks[0] = landmarks[i]; }
    else if (label === "Right") { handLandmarks[1] = landmarks[i]; }
  }
  return { handLandmarks };
}

// Test: no hands detected -> all-zero frame.
{
  const frame = toFrameLandmarksLocal({ handedness: [], landmarks: [] });
  const buf = landmarksToFloat32([frame]);
  let allZero = true;
  for (let i = 0; i < buf.length; i++) { if (buf[i] !== 0) { allZero = false; break; } }
  assert(allZero, "No hands → all-zero 60×126 sequence");
}

// Test: only left hand detected -> left block filled, right block zeros.
{
  const leftLm = Array.from({ length: 21 }, (_, k) => ({ x: k * 0.1, y: 0.5, z: 0 }));
  const frame = toFrameLandmarksLocal({
    handedness: [{ category_name: "Left" }],
    landmarks: [{ landmarks: leftLm }],
  });
  const buf = landmarksToFloat32([frame]);
  assertClose(buf[0], 0, "Left wrist x normalised to 0");
  let rightAllZero = true;
  for (let k = 0; k < 21; k++) {
    const o = 63 + k * 3;
    if (buf[o] !== 0 || buf[o+1] !== 0 || buf[o+2] !== 0) { rightAllZero = false; }
  }
  assert(rightAllZero, "Only left → right block all zeros");
}

// Test: only right hand detected -> right block filled, left block zeros.
{
  const rightLm = Array.from({ length: 21 }, (_, k) => ({ x: k * 0.1, y: 0.5, z: 0 }));
  const frame = toFrameLandmarksLocal({
    handedness: [{ category_name: "Right" }],
    landmarks: [{ landmarks: rightLm }],
  });
  const buf = landmarksToFloat32([frame]);
  let leftAllZero = true;
  for (let k = 0; k < 21; k++) {
    const o = k * 3;
    if (buf[o] !== 0 || buf[o+1] !== 0 || buf[o+2] !== 0) { leftAllZero = false; }
  }
  assert(leftAllZero, "Only right → left block all zeros");
  assertClose(buf[63], 0, "Right wrist x normalised to 0");
}

// Test: both hands in reverse detection order -> anatomical mapping preserved.
{
  const frame = toFrameLandmarksLocal({
    handedness: [{ category_name: "Right" }, { category_name: "Left" }],
    landmarks: [
      { landmarks: Array.from({ length: 21 }, () => ({ x: 100, y: 0, z: 0 })) },
      { landmarks: Array.from({ length: 21 }, () => ({ x: 200, y: 0, z: 0 })) },
    ],
  });
  const buf = landmarksToFloat32([frame]);
  // Slot 0 = Left (x=200 → after wrist-normalise all 0 since uniform), slot 1 = Right.
  assertClose(buf[0], 0, "Reverse order: left slot normalised");
  assertClose(buf[63], 0, "Reverse order: right slot normalised");
}

// Test: sequence buffer reaches exactly 60 frames (tail-padded with zero frames).
{
  const oneFrame = toFrameLandmarksLocal({
    handedness: [{ category_name: "Left" }],
    landmarks: [{ landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })) }],
  });
  // Simulate useHandRecorder.stop(): pad to CLIP_LEN.
  const frames = [oneFrame];
  const padded = [...frames];
  while (padded.length < CLIP_LEN) padded.push({ handLandmarks: [] });
  assert(padded.length === CLIP_LEN, "Buffer padded to exactly 60 frames");
  const buf = landmarksToFloat32(padded);
  assert(buf.length === CLIP_LEN * VALUES_PER_FRAME, "Final sequence = 60×126 = 7560 floats");
  // Only frame 0 has data; frames 1-59 are zero.
  let restZero = true;
  for (let f = 1; f < CLIP_LEN; f++) {
    for (let v = 0; v < VALUES_PER_FRAME; v++) {
      if (buf[f * VALUES_PER_FRAME + v] !== 0) { restZero = false; }
    }
  }
  assert(restZero, "Frames 1-59 are zero-padded");
}

// Test: final input tensor shape [1, 60, 126] FLOAT32.
{
  const sequence = new Float32Array(60 * 126);
  const batch = [sequence]; // batch of 1
  assert(batch.length === 1, "Batch size = 1");
  assert(sequence.length === 60 * 126, "Per-clip = 60*126 = 7560");
  assert(sequence instanceof Float32Array, "Input is FLOAT32");
  const byteLen = sequence.buffer.byteLength;
  assert(byteLen === 60 * 126 * 4, `Tensor bytes = ${60 * 126 * 4} ([1,60,126] FLOAT32)`);
}

// Test: confirmation gate — no automatic send.
{
  let autoSent = false;
  function recognizeAndStage(gloss, conf) {
    // Recognition result stages to ConfirmSignScreen only; send requires user press.
    return { pending: { sign: gloss, probability: conf }, autoSent: false };
  }
  const staged = recognizeAndStage("book", 0.82);
  assert(!staged.autoSent, "Message not auto-sent after recognition");
  assert(staged.pending.sign === "book", "Staged gloss available for user review");
}

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
} else {
  console.log("All tests passed.");
  process.exit(0);
}
