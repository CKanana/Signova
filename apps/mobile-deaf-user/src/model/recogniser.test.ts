import { Platform } from "react-native";

export const MODEL_ASSET = "model/signova_model.tflite";
export const LABELS_ASSET = "model/labels.json";
export const MODEL_INFO_ASSET = "model/model_info.json";

export interface RecogniserResult {
  results: { sign: string; probability: number }[];
  timingMs: number;
}

export type RecogniserBackend = "model" | "mock";

export interface OnDeviceRecognizer {
  run(sequence: Float32Array): Promise<{
    probabilities: Float32Array;
    timingMs: number;
  }>;
  destroy(): void;
}

let nativeModule: OnDeviceRecognizer | null = null;

export function isOnDeviceAvailable(): boolean {
  return Platform.OS !== "web" &&
    process.env.EXPO_PUBLIC_RUN_IN_EXPO !== "1" &&
    nativeModule !== null;
}

export async function loadOnDeviceRecognizer(): Promise<OnDeviceRecognizer | null> {
  if (nativeModule) return nativeModule;

  if (
    Platform.OS === "web" ||
    process.env.EXPO_PUBLIC_RUN_IN_EXPO === "1"
  ) return null;

  try {
    const { loadTensorflowModel } = await import("react-native-fast-tflite");

    const model = await loadTensorflowModel(
      require("../../assets/model/signova_model.tflite")
    );

    nativeModule = {
      run: async (sequence) => {
        const start = Date.now();

        const outputs = await model.run([sequence]);

        const output = outputs[0];
        if (!output) throw new Error("Model returned no output");

        return {
          probabilities: new Float32Array(output),
          timingMs: Date.now() - start,
        };
      },
      destroy: () => {
        model.dispose();
        nativeModule = null;
      },
    };

    return nativeModule;
  } catch (error) {
    console.warn("Signova TFLite unavailable:", error);
    return null;
  }
}

export interface ModelMetadata {
  numClasses: number;
  inputShape: number[];
  outputName: string;
  labelCount: number;
  labels?: string[];
  [key: string]: unknown;
}

export async function loadModelMetadata(): Promise<ModelMetadata> {
  let labels: string[] = [];

  try {
    const mod = await import("../../assets/model/labels.json");
    const data = mod.default ?? mod;
    labels = Array.isArray(data)
      ? data.map(String)
      : Array.isArray((data as any).labels)
        ? (data as any).labels.map(String)
        : Object.values(data as object).map(String);
  } catch {
    console.warn("Could not load Signova labels");
  }

  let info: any = {};

  try {
    const mod = await import("../../assets/model/model_info.json");
    info = mod.default ?? mod;
  } catch {
    console.warn("Could not load model metadata");
  }

  return {
    ...info,
    numClasses: info.numClasses || labels.length,
    inputShape: info.inputShape || [1, 60, 126],
    outputName: info.outputName || "PartitionedCall:0",
    labelCount: labels.length,
    labels,
  };
}

export function softmax(scores: Float32Array): Float32Array {
  if (!scores.length) return new Float32Array();

  const max = Math.max(...scores);
  const out = new Float32Array(scores.length);
  let sum = 0;

  for (let i = 0; i < scores.length; i++) {
    out[i] = Math.exp(scores[i] - max);
    sum += out[i];
  }

  if (!sum) return out;

  for (let i = 0; i < out.length; i++) {
    out[i] /= sum;
  }

  return out;
}

export function topK(
  indices: number[],
  k: number,
  scores: Float32Array,
): number[] {
  return [...indices]
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, k);
}

export async function recogniseOnDevice(
  sequence: Float32Array,
  metadata: ModelMetadata,
  shouldApplySoftmax: boolean,
): Promise<RecogniserResult | null> {
  const recogniser = await loadOnDeviceRecognizer();
  if (!recogniser) return null;

  const { probabilities, timingMs } = await recogniser.run(sequence);
  const scores = shouldApplySoftmax
    ? softmax(probabilities)
    : probabilities;

  const count = Math.min(scores.length, metadata.labelCount);
  const indices = Array.from({ length: count }, (_, i) => i);

  const results = topK(indices, 5, scores).map((i) => ({
    sign: metadata.labels?.[i] ?? `class ${i}`,
    probability: scores[i],
  }));

  while (results.length < 5) {
    results.push({ sign: "unknown", probability: 0 });
  }

  return { results, timingMs };
}