// recogniser.ts — on-device sign recognition for Signova.
//
// MODEL CONTRACT (established by Phase 1 inspection of signova_model.tflite):
//   Input  tensor: 'serving_default_landmark_sequence:0'
//                  shape=[1, 60, 126]  dtype=FLOAT32  (no quantization)
//                  = 1 batch × 60 frames × 126 values
//                  = 2 hands × 21 landmarks × 3 coords (x,y,z) per frame
//   Output tensor: 'PartitionedCall:0'
//                  shape=[1, 2000]  dtype=FLOAT32  (no quantization)
//                  Softmax is already applied in the graph.
//                  DO NOT apply softmax again — output is probabilities, not logits.
//
// react-native-fast-tflite v3 API:
//   loadTensorflowModel(require(...), delegates[]) -> Promise<TfliteModel>
//   model.run([inputArrayBuffer])                  -> Promise<ArrayBuffer[]>
//   model.runSync([inputArrayBuffer])              -> ArrayBuffer[]
//   model.inputs  / model.outputs                 -> Tensor[] metadata
//
// This module never imports native libraries at the module top level.
// All native imports are inside try/catch blocks so Expo Go, the web build,
// and CI environments fall back cleanly without crashing.

import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Asset paths (resolved by Metro at native-build time)
// ---------------------------------------------------------------------------

export const MODEL_ASSET = "model/signova_model.tflite";
export const LABELS_ASSET = "model/labels.json";
export const MODEL_INFO_ASSET = "model/model_info.json";

// ---------------------------------------------------------------------------
// Model contract constants (from Phase 1 inspection — do not invent)
// ---------------------------------------------------------------------------

/** Confirmed input shape from tflite inspection: [batch, frames, values] */
export const MODEL_INPUT_SHAPE = [1, 60, 126] as const;

/** Confirmed output shape from tflite inspection: [batch, num_classes] */
export const MODEL_OUTPUT_SHAPE = [1, 2000] as const;

/** Number of output classes confirmed by tflite inspection. */
export const MODEL_NUM_CLASSES = 2000;

/** Model applies softmax internally — do NOT apply it again. */
export const MODEL_OUTPUT_IS_PROBABILITIES = true;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RecogniserResult {
  results: { sign: string; probability: number }[];
  timingMs: number;
}

export type RecogniserBackend = "model" | "mock";

export interface ModelMetadata {
  numClasses: number;
  inputShape: number[];
  outputName: string;
  labelCount: number;
  labels?: string[];
  outputSoftmaxApplied?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Singleton native model handle
// ---------------------------------------------------------------------------

/** Loaded TfliteModel instance (react-native-fast-tflite v3 TfliteModel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadedModel: any | null = null;

/** Set to true while a model load is in progress (prevents concurrent loads). */
let isModelLoading = false;

/** Set to true while inference is running (prevents concurrent inference). */
let isInferenceRunning = false;

// ---------------------------------------------------------------------------
// Availability probe
// ---------------------------------------------------------------------------

/**
 * True when the native TFLite stack is available in this runtime.
 * Returns false for Expo Go, web, and any build without native modules.
 */
export function isOnDeviceAvailable(): boolean {
  if (Platform.OS === "web") return false;
  if (process.env.EXPO_PUBLIC_RUN_IN_EXPO === "1") return false;
  // Model is considered available once it has been loaded at least once.
  return loadedModel !== null;
}

// ---------------------------------------------------------------------------
// Model loading (react-native-fast-tflite v3)
// ---------------------------------------------------------------------------

/**
 * Load the TFLite model and return the TfliteModel handle.
 * Returns null when unavailable (Expo Go, web, load error).
 * Idempotent — returns the cached handle on subsequent calls.
 * Prevents concurrent loads via `isModelLoading` guard.
 */
export async function loadOnDeviceRecognizer(): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any | null
> {
  if (loadedModel !== null) return loadedModel;
  if (isModelLoading) return null; // concurrent call — let the first one finish
  if (Platform.OS === "web") return null;
  if (process.env.EXPO_PUBLIC_RUN_IN_EXPO === "1") return null;

  isModelLoading = true;
  try {
    // Dynamic import — keeps native module out of Expo Go / web bundle.
    // @ts-ignore — resolved at native-build time, not by tsc.
    const { loadTensorflowModel } = await import("react-native-fast-tflite");

    // Load the model from the Metro-bundled asset.
    // The require() is inside try/catch so a Metro bundling failure (e.g. in
    // Expo Go where .tflite assets aren't bundled) falls back cleanly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modelAsset: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      modelAsset = require("../assets/model/signova_model.tflite");
    } catch {
      console.warn("[recogniser] Could not resolve .tflite asset — Expo Go or web build.");
      loadedModel = null;
      return null;
    }

    loadedModel = await loadTensorflowModel(modelAsset, []);

    // Validate tensor contract at load time so failures surface immediately.
    _validateModelContract(loadedModel);

    return loadedModel;
  } catch (err) {
    // Expo Go, web, missing native modules, or metro asset resolution failure.
    // Log the reason so developers can diagnose, but fall back cleanly.
    console.warn("[recogniser] Failed to load on-device model:", (err as Error).message);
    loadedModel = null;
    return null;
  } finally {
    isModelLoading = false;
  }
}

/**
 * Validate the loaded model's tensor contract against the known spec.
 * Throws if the model doesn't match — catches regressions early.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function _validateModelContract(model: any): void {
  const inputs: { shape: number[]; dataType: string }[] = model.inputs ?? [];
  const outputs: { shape: number[]; dataType: string }[] = model.outputs ?? [];

  if (inputs.length === 0) throw new Error("Model has no input tensors.");
  if (outputs.length === 0) throw new Error("Model has no output tensors.");

  const inp = inputs[0];
  if (!inp) throw new Error("Input tensor[0] is undefined.");

  const expectedIn = MODEL_INPUT_SHAPE;
  const shapeOk =
    inp.shape.length === 3 &&
    inp.shape[0] === expectedIn[0] &&
    inp.shape[1] === expectedIn[1] &&
    inp.shape[2] === expectedIn[2];
  if (!shapeOk) {
    throw new Error(
      `Input shape mismatch. Expected [${expectedIn}], got [${inp.shape}].`,
    );
  }

  const out = outputs[0];
  if (!out) throw new Error("Output tensor[0] is undefined.");
  if (out.shape.length < 2 || out.shape[out.shape.length - 1] !== MODEL_NUM_CLASSES) {
    throw new Error(
      `Output shape mismatch. Expected [..., ${MODEL_NUM_CLASSES}], got [${out.shape}].`,
    );
  }
}

/**
 * Release the native model handle and reset state.
 * Call when the session ends to free memory.
 */
export function destroyRecognizer(): void {
  loadedModel = null;
  isModelLoading = false;
  isInferenceRunning = false;
}

// ---------------------------------------------------------------------------
// Model metadata (from bundled JSON assets — never hard-coded)
// ---------------------------------------------------------------------------

/**
 * Load model metadata from the bundled JSON assets.
 * Gracefully handles missing files — the model contract constants above
 * are the source of truth when the JSON files are absent.
 */
export async function loadModelMetadata(): Promise<ModelMetadata> {
  const metadata: ModelMetadata = {
    numClasses: MODEL_NUM_CLASSES,
    inputShape: [...MODEL_INPUT_SHAPE],
    outputName: "PartitionedCall:0",
    labelCount: MODEL_NUM_CLASSES,
    outputSoftmaxApplied: true,
  };

  // Load labels
  try {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const labelsModule = await import("../assets/model/labels.json") as any;
    const raw = labelsModule.default ?? labelsModule;
    if (Array.isArray(raw) && raw.length > 0) {
      metadata.labels = raw.map((l: unknown) => String(l));
      metadata.labelCount = raw.length;
      if (raw.length !== MODEL_NUM_CLASSES) {
        console.warn(
          `[recogniser] labels.json has ${raw.length} entries but model expects ${MODEL_NUM_CLASSES}.`,
        );
      }
    }
  } catch {
    console.warn("[recogniser] labels.json not found — class names will show as 'class N'.");
  }

  // Load model_info.json — may override defaults
  try {
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const infoModule = await import("../assets/model/model_info.json") as any;
    const info = infoModule.default ?? infoModule;
    if (typeof info.numClasses === "number" && info.numClasses > 0) {
      metadata.numClasses = info.numClasses;
    }
    if (Array.isArray(info.inputShape)) metadata.inputShape = info.inputShape;
    if (typeof info.outputName === "string") metadata.outputName = info.outputName;
    if (typeof info.outputSoftmaxApplied === "boolean") {
      metadata.outputSoftmaxApplied = info.outputSoftmaxApplied;
    }
  } catch {
    // model_info.json is optional — use defaults.
  }

  return metadata;
}

// ---------------------------------------------------------------------------
// Inference helpers
// ---------------------------------------------------------------------------

/**
 * Softmax of a score vector (safe for all-zero inputs).
 * Only used when the model outputs raw logits. The signova_model.tflite
 * already applies softmax, so this function is kept for completeness and
 * should NOT be called in the normal inference path.
 */
export function softmax(scores: Float32Array): Float32Array {
  let max = -Infinity;
  const n = scores.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (scores[i] > max) max = scores[i];
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.exp(scores[i] - max);
    out[i] = e;
    sum += e;
  }
  if (sum === 0) return out;
  for (let i = 0; i < n; i++) out[i] /= sum;
  return out;
}

/**
 * Return the k highest-scoring indices in descending order.
 */
export function topK(
  indices: number[],
  k: number,
  scores: Float32Array,
): number[] {
  const sorted = [...indices];
  sorted.sort((a, b) => scores[b] - scores[a]);
  return sorted.slice(0, k);
}

// ---------------------------------------------------------------------------
// On-device inference
// ---------------------------------------------------------------------------

/**
 * Run one inference pass on a preprocessed 60-frame clip.
 *
 * @param sequence     Float32Array of shape [60 * 126] = 7560 elements.
 *                     Produced by preprocess.ts:landmarksToFloat32().
 * @param metadata     Loaded via loadModelMetadata(). Controls label lookup.
 * @param shouldApplySoftmax
 *                     Pass FALSE for signova_model.tflite — softmax is
 *                     already applied in the graph. Pass TRUE only if a
 *                     future retrained model outputs raw logits.
 * @returns Top-5 results or null if the model is unavailable.
 */
export async function recogniseOnDevice(
  sequence: Float32Array,
  metadata: ModelMetadata,
  shouldApplySoftmax: boolean,
): Promise<RecogniserResult | null> {
  const model = await loadOnDeviceRecognizer();
  if (!model) return null;

  // Prevent concurrent inference — TFLite interpreters are not thread-safe.
  if (isInferenceRunning) {
    console.warn("[recogniser] Inference already running — skipping duplicate call.");
    return null;
  }
  isInferenceRunning = true;

  try {
    const t0 = Date.now();

    // react-native-fast-tflite v3: input is ArrayBuffer[].
    // Float32Array.buffer gives the backing ArrayBuffer.
    const inputBuffer = sequence.buffer as ArrayBuffer;

    const outputBuffers: ArrayBuffer[] = await model.run([inputBuffer]);

    const timingMs = Date.now() - t0;

    if (!outputBuffers || outputBuffers.length === 0) {
      throw new Error("Model returned no output buffers.");
    }

    // Output is [1, 2000] FLOAT32. Buffer size = 2000 * 4 = 8000 bytes.
    const outputBuffer = outputBuffers[0];
    const rawScores = new Float32Array(outputBuffer);

    if (rawScores.length === 0) {
      throw new Error("Output buffer is empty.");
    }

    // Probabilities: model already applied softmax. Only apply again if
    // explicitly requested (future retrained logit model).
    const prob = shouldApplySoftmax ? softmax(rawScores) : rawScores;

    // Clamp to the number of known labels to avoid out-of-bounds label lookup.
    const numLabels = Math.min(prob.length, metadata.labelCount || MODEL_NUM_CLASSES);
    const indices = Array.from({ length: numLabels }, (_, i) => i);
    const topIndices = topK(indices, 5, prob);

    const results: { sign: string; probability: number }[] = topIndices.map((i) => ({
      sign: metadata.labels?.[i] ?? `class_${i}`,
      probability: prob[i] ?? 0,
    }));

    // Always return exactly 5 results (pad with zero-probability unknowns).
    while (results.length < 5) {
      results.push({ sign: "unknown", probability: 0 });
    }

    return { results, timingMs };
  } catch (err) {
    console.error("[recogniser] Inference error:", (err as Error).message);
    throw err;
  } finally {
    isInferenceRunning = false;
  }
}
