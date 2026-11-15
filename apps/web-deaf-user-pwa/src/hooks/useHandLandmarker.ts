// useHandLandmarker.ts — browser MediaPipe Hand Landmarker (PWA port).
// Replaces the native expo-hand-landmarker module with @mediapipe/tasks-vision
// running in VIDEO mode on an HTMLVideoElement. Results are converted through
// the existing mediapipe-adapter.ts (anatomical left/right slots) and pushed
// into the useHandRecorder ring buffer — exactly the same pipeline the native
// module fed, so preprocess.ts and the recogniser are unchanged.
//
// Responsibilities:
//   1. Load the MediaPipe vision wasm files from /wasm-vision/.
//   2. Create a HandLandmarker in VIDEO mode with the bundled hand_landmarker.task.
//   3. On each camera frame, run detectForVideo, convert via the adapter, and
//      push the FrameLandmarks into onFrame (the recorder's pushFrame).
//   4. Destroy the detector when the session ends.
//
// FilesetResolver + HandLandmarker are created once and reused.

import { useCallback, useEffect, useRef } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { HandLandmarksPerFrame } from "./useHandRecorder";

export interface UseHandLandmarkerOptions {
  landmarkerOptions?: {
    numHands?: number;
    minHandDetectionConfidence?: number;
    minHandPresenceConfidence?: number;
    minTrackingConfidence?: number;
  };
  onFrame: (frame: HandLandmarksPerFrame) => void;
}

export interface UseHandLandmarkerReturn {
  isReady: boolean;
  isInitialising: boolean;
  isUnavailable: boolean;
  error: string | null;
  initialise: () => Promise<void>;
  destroy: () => Promise<void>;
  processFrame: (videoElement: HTMLVideoElement, timestampMs: number) => void;
}

const WASM_PATH = "/wasm-vision/";
const MODEL_PATH = "/models/hand_landmarker.task";

/** Confidence above which at least one hand is considered reliably detected. */
const HAND_DETECTION_THRESHOLD = 0.5;

/** A single hand's 21 landmarks, each { x, y, z } (dropped MediaPipe extras). */
type AHandLandmarks = Array<{ x: number; y: number; z: number }>;

/** MediaPipe handedness metadata for one detected hand. */
type AHandednessEntry = Array<{ categoryName: string }>;

/** MediaPipe result payload, narrowed to the parallel-array shape we consume. */
type ACameraHand = { handedness: AHandednessEntry[]; landmarks: AHandLandmarks[] };

export function useHandLandmarker({
  landmarkerOptions,
  onFrame,
}: UseHandLandmarkerOptions): UseHandLandmarkerReturn {
  const isReadyRef = useRef(false);
  const isInitialisingRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);

  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  /**
   * Convert a MediaPipe HandLandmarkerResult into Signova's FrameLandmarks
   * contract. MediaPipe returns two parallel arrays: `landmarks[i]` (the
   * 21 {x,y,z} landmarks for hand i) and `handedness[i]` (the Category[]
   * metadata for hand i, whose first entry carries `categoryName` "Left" or
   * "Right"). We map each detected hand onto the anatomical slot — slot 0 =
   * LEFT, slot 1 = RIGHT — so the recorder / preprocess / model contract is
   * preserved exactly.
   */
  function decodeFrame(result: HandLandmarkerResult): {
    frame: HandLandmarksPerFrame;
    error: string | null;
    confidence: number;
  } {
    const handedness = result.handedness ?? [];
    const landmarks = result.landmarks ?? [];

    // Sanity guard: one handedness entry per landmark array.
    if (handedness.length !== landmarks.length) {
      return {
        frame: { handLandmarks: [] },
        error: `HandLandmarker returned ${landmarks.length} landmark array(s) but ${handedness.length} handedness entry/entries.`,
        confidence: 0,
      };
    }

    // Narrow to the parallel-array shape (each entry is a plain { x, y, z }[]
    // or Category[]). We avoid importing the full MediaPipe types here so the
    // compiler keeps the narrow shape without widening.
    const narrowResult: ACameraHand = {
      handedness: handedness as AHandednessEntry[],
      landmarks: landmarks as AHandLandmarks[],
    };

    let leftSeen = false;
    let rightSeen = false;
    const slots: Array<{ landmarks: AHandLandmarks } | null> = [null, null];

    for (let i = 0; i < narrowResult.landmarks.length; i++) {
      const hand = narrowResult.handedness[i];
      const cat = hand && hand.length > 0 ? hand[0] : null;
      const label = cat?.categoryName ?? "";

      const coords = narrowResult.landmarks[i] ?? [];

      if (label === "Left") {
        if (leftSeen) {
          return {
            frame: { handLandmarks: [] },
            error: `Duplicate left hand handedness detected at index ${i}.`,
            confidence: 0,
          };
        }
        leftSeen = true;
        slots[0] = { landmarks: coords };
      } else if (label === "Right") {
        if (rightSeen) {
          return {
            frame: { handLandmarks: [] },
            error: `Duplicate right hand handedness detected at index ${i}.`,
            confidence: 0,
          };
        }
        rightSeen = true;
        slots[1] = { landmarks: coords };
      }
    }

    const frame: HandLandmarksPerFrame = {
      handLandmarks: slots as HandLandmarksPerFrame["handLandmarks"],
    };

    let confidence = 0;
    if (leftSeen) confidence += 0.5;
    if (rightSeen) confidence += 0.5;

    return { frame, error: null, confidence };
  }

  const handleResult = useCallback((result: HandLandmarkerResult): void => {
    try {
      const decoded = decodeFrame(result);

      // Push the decoded per-hand landmarks; a hand missing from a frame is a
      // zero-fill slot for the recorder / preprocess contract.
      const recorderFrame: HandLandmarksPerFrame = decoded.frame;

      onFrameRef.current(recorderFrame);

      if (decoded.error) {
        console.warn(
          "[useHandLandmarker] Frame decode warning:",
          decoded.error,
          "score:",
          decoded.confidence,
        );
      }
    } catch (err) {
      console.warn("[useHandLandmarker] Frame decode error:", (err as Error).message);
    }
  }, []);

  const initialise = useCallback(async () => {
    if (isReadyRef.current || isInitialisingRef.current) return;
    isInitialisingRef.current = true;
    errorRef.current = null;

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: landmarkerOptions?.numHands ?? 2,
        minHandDetectionConfidence: landmarkerOptions?.minHandDetectionConfidence ?? HAND_DETECTION_THRESHOLD,
        minHandPresenceConfidence: landmarkerOptions?.minHandPresenceConfidence ?? HAND_DETECTION_THRESHOLD,
        minTrackingConfidence: landmarkerOptions?.minTrackingConfidence ?? HAND_DETECTION_THRESHOLD,
      });

      landmarkerRef.current = landmarker;
      isReadyRef.current = true;
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown error";
      errorRef.current = `HandLandmarker init failed: ${msg}`;
      console.warn("[useHandLandmarker]", errorRef.current);
    } finally {
      isInitialisingRef.current = false;
    }
  }, [landmarkerOptions]);

  const destroy = useCallback(async () => {
    isReadyRef.current = false;
    if (landmarkerRef.current) {
      try {
        landmarkerRef.current.close();
      } catch {
        // ignore
      }
      landmarkerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      void destroy();
    };
  }, [destroy]);

  /** Submit a decoded camera frame to the MediaPipe video detector. */
  const processFrame = useCallback(
    (videoElement: HTMLVideoElement, timestampMs: number): void => {
      if (!isReadyRef.current || !landmarkerRef.current) return;
      try {
        const result = landmarkerRef.current.detectForVideo(videoElement, timestampMs);
        handleResult(result);
      } catch (err) {
        console.warn("[useHandLandmarker] processFrame error:", (err as Error).message);
      }
    },
    [handleResult],
  );

  return {
    get isReady() {
      return isReadyRef.current;
    },
    get isInitialising() {
      return isInitialisingRef.current;
    },
    isUnavailable: false,
    get error() {
      return errorRef.current;
    },
    processFrame,
    initialise,
    destroy,
  };
}
