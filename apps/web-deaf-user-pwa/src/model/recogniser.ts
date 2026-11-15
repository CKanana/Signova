// recogniser.ts — on-device sign recognition for Signova (PWA port).
//
// Uses LiteRT.js (@litertjs/core) to run the existing signova_model.tflite
// entirely in the browser (CPU/XNNPACK via WebAssembly), so no native
// modules and no cloud inference are required.
//
// MODEL CONTRACT (verified by loading signova_model.tflite in LiteRT.js):
//   Input  tensor: 'landmark_sequence'   shape=[1, 60, 126]  dtype=float32
//   Output tensor: 'output_0'            shape=[1, 2000]    dtype=float32
//                  Softmax is already applied in the graph.
//                  DO NOT apply softmax again — output is probabilities.
//
// NOTE: the task spec and model_info.json cite tensor names
// 'serving_default_landmark_sequence:0' / 'PartitionedCall:0', but the actual
// exported binary exposes 'landmark_sequence' / 'output_0'. Tensor names are
// discovered at runtime via getInputDetails()/getOutputDetails() so the code
// never hard-codes a stale name.

import {
  loadLiteRt,
  loadAndCompile,
  Tensor,
  type CompiledModel,
  type DType,
} from "@litertjs/core";

// ---------------------------------------------------------------------------
// Asset paths (served from /public, cached by the PWA service worker)
// ---------------------------------------------------------------------------

export const MODEL_ASSET = "/model/signova_model.tflite";
export const LABELS_ASSET = "/model/labels.json";
export const MODEL_INFO_ASSET = "/model/model_info.json";
export const WASM_PATH = "/wasm/";

// ---------------------------------------------------------------------------
// Model contract constants (verified against the exported TFLite binary)
// ---------------------------------------------------------------------------

export const MODEL_INPUT_SHAPE: number[] = [1, 60, 126];
export const MODEL_OUTPUT_SHAPE: number[] = [1, 2000];
export const MODEL_NUM_CLASSES = 2000;
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
  /** True only when every label map entry is a real class name (no placeholders). */
  labelMapAuthoritative?: boolean;
  /** Number of label-map entries that are real (non-placeholder) class names. */
  realLabelCount?: number;
  /** Number of label-map entries that are placeholders (e.g. "class_0261"). */
  placeholderLabelCount?: number;
  [key: string]: unknown;
}

/** A placeholder entry is a synthetic "class_NNNN" with no real ASL gloss. */
export function isPlaceholderLabel(label: string): boolean {
  return /^class_\d+$/.test(label);
}

// ---------------------------------------------------------------------------
// Singleton compiled model handle
// ---------------------------------------------------------------------------

let loadedModel: CompiledModel | null = null;
let outputName = "output_0";
let isInferenceRunning = false;

let modelLoadPromise: Promise<CompiledModel | null> | null = null;

// ---------------------------------------------------------------------------
// Availability probe
// ---------------------------------------------------------------------------

export function isOnDeviceAvailable(): boolean {
  return loadedModel !== null;
}

// ---------------------------------------------------------------------------
// Model loading (LiteRT.js)
// ---------------------------------------------------------------------------

export async function loadOnDeviceRecognizer(): Promise<CompiledModel | null> {
  if (loadedModel !== null) return loadedModel;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      await loadLiteRt(WASM_PATH);

      const model = await loadAndCompile(MODEL_ASSET, {
        accelerator: "wasm",
      });

      // Validate tensor contract at load time.
      _validateModelContract(model);

      loadedModel = model;
      return model;
    } catch (err) {
      console.warn("[recogniser] Failed to load on-device model:", (err as Error).message);
      loadedModel = null;
      return null;
    } finally {
      modelLoadPromise = null;
    }
  })();

  return modelLoadPromise;
}

function _validateModelContract(model: CompiledModel): void {
  const inputs = model.getInputDetails();
  const outputs = model.getOutputDetails();

  if (inputs.length === 0) throw new Error("Model has no input tensors.");
  if (outputs.length === 0) throw new Error("Model has no output tensors.");

  const inp = inputs[0];
  const out = outputs[0];

  outputName = out.name;

  const expectedIn = MODEL_INPUT_SHAPE;
  const inShape = Array.from(inp.shape as unknown as number[]);
  const shapeOk =
    inShape.length === 3 &&
    inShape[0] === expectedIn[0] &&
    inShape[1] === expectedIn[1] &&
    inShape[2] === expectedIn[2];
  if (!shapeOk) {
    throw new Error(`Input shape mismatch. Expected [${expectedIn}], got [${inShape}].`);
  }

  const outShape = Array.from(out.shape as unknown as number[]);
  if (outShape.length < 2 || outShape[outShape.length - 1] !== MODEL_NUM_CLASSES) {
    throw new Error(
      `Output shape mismatch. Expected [..., ${MODEL_NUM_CLASSES}], got [${outShape}].`,
    );
  }

  if (inp.dtype !== "float32") {
    throw new Error(`Input dtype mismatch. Expected float32, got ${inp.dtype}.`);
  }
  if (out.dtype !== "float32") {
    throw new Error(`Output dtype mismatch. Expected float32, got ${out.dtype}.`);
  }
}

/** Release the compiled model handle and reset state. */
export function destroyRecognizer(): void {
  if (loadedModel) {
    try {
      loadedModel.delete();
    } catch {
      // ignore
    }
  }
  loadedModel = null;
  outputName = "output_0";
  modelLoadPromise = null;
  isInferenceRunning = false;
}

// ---------------------------------------------------------------------------
// Model metadata (from bundled JSON assets)
// ---------------------------------------------------------------------------

export async function loadModelMetadata(): Promise<ModelMetadata> {
  const metadata: ModelMetadata = {
    numClasses: MODEL_NUM_CLASSES,
    inputShape: [...MODEL_INPUT_SHAPE],
    outputName: outputName,
    labelCount: MODEL_NUM_CLASSES,
    outputSoftmaxApplied: true,
  };

  try {
    const res = await fetch(LABELS_ASSET);
    if (res.ok) {
      const raw = await res.json();
      if (Array.isArray(raw) && raw.length > 0) {
        const labels = raw.map((l: unknown) => String(l));
        metadata.labels = labels;
        metadata.labelCount = raw.length;
        let realLabelCount = 0;
        let placeholderLabelCount = 0;
        for (const label of labels) {
          if (isPlaceholderLabel(label)) {
            placeholderLabelCount++;
          } else {
            realLabelCount++;
          }
        }
        metadata.realLabelCount = realLabelCount;
        metadata.placeholderLabelCount = placeholderLabelCount;
        // The map is authoritative only when it contains no placeholder entries.
        metadata.labelMapAuthoritative = placeholderLabelCount === 0;
        if (raw.length !== MODEL_NUM_CLASSES) {
          console.warn(
            `[recogniser] labels.json has ${raw.length} entries but model expects ${MODEL_NUM_CLASSES}.`,
          );
        }
        if (!metadata.labelMapAuthoritative) {
          console.warn(
            `[recogniser] labels.json has ${placeholderLabelCount} placeholder entry/entries out of ${raw.length}; ` +
              `only ${realLabelCount} entries are real class names. Placeholder predictions are reported as "unknown".`,
          );
        }
      }
    }
  } catch {
    console.warn("[recogniser] labels.json not found — class names will show as 'class N'.");
  }

  try {
    const res = await fetch(MODEL_INFO_ASSET);
    if (res.ok) {
      const info = await res.json();
      if (typeof info.numClasses === "number" && info.numClasses > 0) {
        metadata.numClasses = info.numClasses;
      }
      if (Array.isArray(info.inputShape)) metadata.inputShape = info.inputShape;
      if (typeof info.outputName === "string") metadata.outputName = info.outputName;
      if (typeof info.outputSoftmaxApplied === "boolean") {
        metadata.outputSoftmaxApplied = info.outputSoftmaxApplied;
      }
    }
  } catch {
    // model_info.json is optional — use defaults.
  }

  return metadata;
}

// ---------------------------------------------------------------------------
// Inference helpers
// ---------------------------------------------------------------------------

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

export function topK(indices: number[], k: number, scores: Float32Array): number[] {
  const sorted = [...indices];
  sorted.sort((a, b) => scores[b] - scores[a]);
  return sorted.slice(0, k);
}

// ---------------------------------------------------------------------------
// On-device inference
// ---------------------------------------------------------------------------

export async function recogniseOnDevice(
  sequence: Float32Array,
  metadata: ModelMetadata,
  shouldApplySoftmax: boolean,
): Promise<RecogniserResult | null> {
  const model = await loadOnDeviceRecognizer();
  if (!model) return null;

  if (isInferenceRunning) {
    console.warn("[recogniser] Inference already running — skipping duplicate call.");
    return null;
  }
  isInferenceRunning = true;

  try {
    const t0 = performance.now();

    const inputTensor = new Tensor(sequence, MODEL_INPUT_SHAPE, "float32" as DType);

    const outputBuffers: Tensor[] = await model.run([inputTensor]);

    const timingMs = performance.now() - t0;

    const outputTensor = outputBuffers[0] ?? outputBuffers.find((t) => t.type.dtype === "float32");
    if (!outputTensor) {
      throw new Error("Model returned no float32 output tensor.");
    }

    const rawScores = (await outputTensor.data()) as Float32Array;
    inputTensor.delete();
    outputTensor.delete();

    if (rawScores.length === 0) {
      throw new Error("Output buffer is empty.");
    }

    const prob = shouldApplySoftmax ? softmax(rawScores) : rawScores;

    const numLabels = Math.min(prob.length, metadata.labelCount || MODEL_NUM_CLASSES);
    const indices = Array.from({ length: numLabels }, (_, i) => i);
    const topIndices = topK(indices, 5, prob);

    const results: { sign: string; probability: number }[] = topIndices.map((i) => {
      const rawLabel = metadata.labels?.[i] ?? `class_${i}`;
      // Never present a placeholder label (e.g. "class_0261") as a real ASL word.
      const sign = isPlaceholderLabel(rawLabel) ? "unknown" : rawLabel;
      return { sign, probability: prob[i] ?? 0 };
    });

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
