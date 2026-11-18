// useHandLandmarker.ts — browser MediaPipe Hand Landmarker (PWA port).
// Replaces the native expo-hand-landmarker module with @mediapipe/tasks-vision
// running in VIDEO mode on an HTMLVideoElement. Results are converted through
// the existing mediapipe-adapter.ts contract (anatomical left/right slots) and
// pushed into the caller's onFrame callback.
//
// Responsibilities:
//   1. Load the MediaPipe vision wasm files from /wasm-vision/.
//   2. Create a HandLandmarker in VIDEO mode with the bundled hand_landmarker.task.
//      Tries the GPU delegate first, falls back to CPU.
//   3. On each camera frame, run detectForVideo, convert via the adapter, and
//      push the FrameLandmarks plus per-hand handedness info into onFrame.
//   4. Destroy the detector when the session ends.
//
// FilesetResolver + HandLandmarker are created once and reused.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";
import type { HandLandmarksPerFrame, HandInfo } from "../../../../shared/types/session";
import { SIGN_CONFIG } from "../config";

export interface UseHandLandmarkerOptions {
  landmarkerOptions?: {
    numHands?: number;
    minHandDetectionConfidence?: number;
    minHandPresenceConfidence?: number;
    minTrackingConfidence?: number;
  };
  onFrame: (frame: HandLandmarksPerFrame, handInfos: HandInfo[]) => void;
}

export interface UseHandLandmarkerReturn {
  isReady: boolean;
  isInitialising: boolean;
  isUnavailable: boolean;
  error: string | null;
  delegate: "GPU" | "CPU" | null;
  initialise: () => Promise<void>;
  destroy: () => Promise<void>;
  processFrame: (videoElement: HTMLVideoElement, timestampMs: number) => void;
}

const WASM_PATH = "/wasm-vision/";
const MODEL_PATH = "/models/hand_landmarker.task";

/** A single hand's 21 landmarks, each { x, y, z } (dropped MediaPipe extras). */
type AHandLandmarks = Array<{ x: number; y: number; z: number }>;

/** MediaPipe handedness metadata for one detected hand. */
type AHandednessEntry = Array<{ categoryName: string; score?: number }>;

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
  const delegateRef = useRef<"GPU" | "CPU" | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isInitialising, setIsInitialising] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
   *
   * NOTE: for selfie (mirrored) video the camera frame shown to the user is
   * flipped, but MediaPipe processes the intrinsic (unflipped) frames. The
   * anatomical slot mapping below matches the training extraction
   * (dataset.py: left block first, then right block, keyed on MediaPipe's
   * category_name). See the screen debug panel for per-hand label/score/slot.
   */
  function decodeFrame(result: HandLandmarkerResult): {
    frame: HandLandmarksPerFrame;
    handInfos: HandInfo[];
    error: string | null;
    confidence: number;
  } {
    const handedness = result.handedness ?? [];
    const landmarks = result.landmarks ?? [];

    if (handedness.length !== landmarks.length) {
      return {
        frame: { handLandmarks: [null, null] },
        handInfos: [],
        error: `HandLandmarker returned ${landmarks.length} landmark array(s) but ${handedness.length} handedness entry/entries.`,
        confidence: 0,
      };
    }

    const narrowResult: ACameraHand = {
      handedness: handedness as AHandednessEntry[],
      landmarks: landmarks as AHandLandmarks[],
    };

    let leftSeen = false;
    let rightSeen = false;
    const slots: Array<{ landmarks: AHandLandmarks } | null> = [null, null];
    const handInfos: HandInfo[] = [];

    for (let i = 0; i < narrowResult.landmarks.length; i++) {
      const hand = narrowResult.handedness[i];
      const cat = hand && hand.length > 0 ? hand[0] : null;
      const label = (cat?.categoryName ?? "") as "Left" | "Right" | null;
      const score = typeof cat?.score === "number" ? cat.score : 0;
      const coords = narrowResult.landmarks[i] ?? [];

      let slot: 0 | 1 | null = null;
      if (label === "Left") {
        if (leftSeen) continue; // ignore duplicate handedness detections
        leftSeen = true;
        slot = 0;
        slots[0] = { landmarks: coords };
      } else if (label === "Right") {
        if (rightSeen) continue; // ignore duplicate handedness detections
        rightSeen = true;
        slot = 1;
        slots[1] = { landmarks: coords };
      }

      handInfos.push({ slot, label, score, landmarks: coords.length ? coords : null });
    }

    const frame: HandLandmarksPerFrame = {
      handLandmarks: slots as HandLandmarksPerFrame["handLandmarks"],
    };

    let confidence = 0;
    if (leftSeen) confidence += 0.5;
    if (rightSeen) confidence += 0.5;

    return { frame, handInfos, error: null, confidence };
  }

  const handleResult = useCallback((result: HandLandmarkerResult): void => {
    try {
      const decoded = decodeFrame(result);

      // Push the decoded per-hand landmarks; a hand missing from a frame is a
      // zero-fill slot for the preprocess contract.
      onFrameRef.current(decoded.frame, decoded.handInfos);

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

  const createLandmarker = async (delegate: "GPU" | "CPU"): Promise<HandLandmarker> => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_PATH,
        delegate,
      },
      runningMode: "VIDEO",
      numHands: landmarkerOptions?.numHands ?? SIGN_CONFIG.NUM_HANDS,
      minHandDetectionConfidence:
        landmarkerOptions?.minHandDetectionConfidence ?? SIGN_CONFIG.MIN_HAND_DETECTION_CONFIDENCE,
      minHandPresenceConfidence:
        landmarkerOptions?.minHandPresenceConfidence ?? SIGN_CONFIG.MIN_HAND_PRESENCE_CONFIDENCE,
      minTrackingConfidence:
        landmarkerOptions?.minTrackingConfidence ?? SIGN_CONFIG.MIN_TRACKING_CONFIDENCE,
    });
  };

  const initialise = useCallback(async () => {
    if (isReadyRef.current || isInitialisingRef.current) return;
    isInitialisingRef.current = true;
    errorRef.current = null;
    setError(null);
    setIsInitialising(true);

    try {
      try {
        const landmarker = await createLandmarker("GPU");
        landmarkerRef.current = landmarker;
        delegateRef.current = "GPU";
        isReadyRef.current = true;
        setIsReady(true);
        return;
      } catch (gpuErr) {
        console.warn("[useHandLandmarker] GPU delegate unavailable, falling back to CPU:", (gpuErr as Error).message);
      }

      const landmarker = await createLandmarker("CPU");
      landmarkerRef.current = landmarker;
      delegateRef.current = "CPU";
      isReadyRef.current = true;
      setIsReady(true);
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown error";
      errorRef.current = `HandLandmarker init failed: ${msg}`;
      setError(errorRef.current);
      console.warn("[useHandLandmarker]", errorRef.current);
    } finally {
      isInitialisingRef.current = false;
      setIsInitialising(false);
    }
  }, [landmarkerOptions]);

  const destroy = useCallback(async () => {
    isReadyRef.current = false;
    delegateRef.current = null;
    setIsReady(false);
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
    isReady,
    isInitialising,
    isUnavailable: false,
    error,
    get delegate() {
      return delegateRef.current;
    },
    processFrame,
    initialise,
    destroy,
  };
}
