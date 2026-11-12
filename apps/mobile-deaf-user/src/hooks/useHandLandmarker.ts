/**
 * useHandLandmarker.ts
 *
 * Bridges the ExpoHandLandmarker native module with the existing
 * mediapipe-adapter.ts and useHandRecorder.ts pipeline.
 *
 * Responsibilities:
 *   1. Initialise the MediaPipe HandLandmarker when a session starts.
 *   2. Subscribe to "onHandLandmarkerResult" events from the native module.
 *   3. Convert each event payload into a FrameLandmarks using mediapipe-adapter.ts.
 *   4. Push each frame into the useHandRecorder frame buffer.
 *   5. Destroy the detector when the session ends.
 *
 * This hook does NOT touch preprocess.ts or recogniser.ts — the recorder
 * hook already builds the Float32Array and the session context runs inference.
 *
 * FALLBACK:
 *   When the native module is unavailable (Expo Go, web, iOS, build without
 *   the module installed), the hook is a no-op and the session falls back to
 *   the existing zero-frame path (server-side placeholder translation).
 */

import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import {
  initHandLandmarker,
  destroyHandLandmarker,
  addHandResultListener,
  isHandLandmarkerAvailable,
  processFrame,
  type HandLandmarkerResult,
  type HandLandmarkerOptions,
} from "../../modules/expo-hand-landmarker/src";
import { toFrameLandmarks } from "../model/mediapipe-adapter";
import type { HandLandmarksPerFrame } from "./useHandRecorder";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UseHandLandmarkerOptions {
  /** MediaPipe options (passed to initHandLandmarker). */
  landmarkerOptions?: HandLandmarkerOptions;
  /**
   * Called with each decoded FrameLandmarks. Connect this to the
   * useHandRecorder frameHandler so frames flow into the ring buffer.
   */
  onFrame: (frame: HandLandmarksPerFrame) => void;
}

export interface UseHandLandmarkerReturn {
  /** True when the native module is loaded and the detector is ready. */
  isReady: boolean;
  /** True on platforms where hand detection is not available. */
  isUnavailable: boolean;
  /** Non-null if initialisation or frame processing encountered an error. */
  error: string | null;
  /**
   * Submit a camera frame (base64 JPEG) to the MediaPipe HandLandmarker.
   * Results are delivered asynchronously via the onFrame callback.
   * Safe to call each camera frame; the native module drops frames while busy.
   */
  processFrame: (base64Jpeg: string, isFrontCamera: boolean, timestampMs: number) => void;
  /**
   * Call when the camera is ready and you want to start receiving results.
   * Safe to call multiple times (idempotent after first init).
   */
  initialise: () => Promise<void>;
  /**
   * Call when the session ends to free the detector.
   */
  destroy: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHandLandmarker({
  landmarkerOptions,
  onFrame,
}: UseHandLandmarkerOptions): UseHandLandmarkerReturn {
  const isReadyRef = useRef(false);
  const isInitialisingRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof addHandResultListener> | null>(null);

  const isUnavailable =
    Platform.OS !== "android" || !isHandLandmarkerAvailable();

  // Stable callback ref so the subscription closure is always current.
  const onFrameRef = useRef(onFrame);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  // Handler: native module → mediapipe-adapter → useHandRecorder frame buffer
  const handleResult = useCallback((result: HandLandmarkerResult) => {
    try {
      // Convert to MediaPipe adapter input format
      const mpFrame = {
        handedness: result.hands.map((h) => ({ category_name: h.handedness })),
        landmarks: result.hands.map((h) => ({ landmarks: h.landmarks })),
      };

      // Adapter converts to FrameLandmarks (slot 0 = left, slot 1 = right)
      const frameLandmarks = toFrameLandmarks(mpFrame);

      // Push into recorder's ring buffer
      const recorderFrame: HandLandmarksPerFrame = {
        handLandmarks: frameLandmarks.handLandmarks
          ?.map((h) => (h ? { landmarks: h.landmarks } : undefined))
          .filter((h): h is { landmarks: { x: number; y: number; z: number }[] } => !!h),
      };

      onFrameRef.current(recorderFrame);
    } catch (err) {
      // Adapter throws on invalid handedness — log but don't crash the session.
      console.warn("[useHandLandmarker] Frame decode error:", (err as Error).message);
    }
  }, []);

  const initialise = useCallback(async () => {
    if (isUnavailable) return;
    if (isReadyRef.current || isInitialisingRef.current) return;
    isInitialisingRef.current = true;
    errorRef.current = null;

    try {
      await initHandLandmarker(landmarkerOptions ?? {});

      // Subscribe to frame events
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
      subscriptionRef.current = addHandResultListener(handleResult);
      isReadyRef.current = true;
    } catch (err) {
      const msg = (err as Error).message ?? "Unknown error";
      errorRef.current = `HandLandmarker init failed: ${msg}`;
      console.warn("[useHandLandmarker]", errorRef.current);
    } finally {
      isInitialisingRef.current = false;
    }
  }, [isUnavailable, landmarkerOptions, handleResult]);

  const destroy = useCallback(async () => {
    isReadyRef.current = false;
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    if (!isUnavailable) {
      try {
        await destroyHandLandmarker();
      } catch (err) {
        console.warn("[useHandLandmarker] destroy error:", (err as Error).message);
      }
    }
  }, [isUnavailable]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, []);

  // Frame submission: camera → MediaPipe → adapter → recorder
  const submitFrame = useCallback(
    (base64Jpeg: string, isFrontCamera: boolean, timestampMs: number): void => {
      if (isUnavailable) return;
      void processFrame(base64Jpeg, isFrontCamera, timestampMs).catch((err) => {
        console.warn("[useHandLandmarker] processFrame error:", (err as Error).message);
      });
    },
    [isUnavailable],
  );

  return {
    get isReady() { return isReadyRef.current; },
    isUnavailable,
    get error() { return errorRef.current; },
    processFrame: submitFrame,
    initialise,
    destroy,
  };
}
