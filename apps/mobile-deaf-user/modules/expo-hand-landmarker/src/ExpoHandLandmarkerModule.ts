/**
 * ExpoHandLandmarkerModule.ts
 *
 * TypeScript interface for the native ExpoHandLandmarker Expo Module.
 *
 * This module wraps MediaPipe's HandLandmarker Task API on Android (Kotlin)
 * via the Expo Modules API. On iOS and web the module returns null (not
 * supported in this milestone).
 *
 * CONTRACT — matches the Signova training pipeline:
 *   - Up to 2 hands detected per frame.
 *   - Each hand has 21 landmarks with (x, y, z) in normalised image coordinates.
 *   - Handedness is returned as "Left" or "Right" from the signer's perspective
 *     (MediaPipe reports from the image perspective on the front camera, which
 *     is already mirrored — so "Left" in the image = anatomical left hand).
 *   - Missing hands are omitted from the result; the adapter zero-fills them.
 *
 * NOTE: Front-camera mirroring and handedness semantics.
 *   MediaPipe reports handedness from the model's perspective looking at the
 *   image. When the front camera is used with mirror=true (Expo Camera default)
 *   the image is not flipped for display but the camera still captures the
 *   mirrored image before display. MediaPipe's hand landmarker receives the
 *   raw (unmirrored) camera frame and reports:
 *     "Left"  in the image  =  anatomical RIGHT hand of the signer
 *     "Right" in the image  =  anatomical LEFT  hand of the signer
 *   The Android Kotlin implementation therefore SWAPS the labels when the
 *   front camera is active so that the TypeScript layer always receives
 *   anatomically-correct labels. This matches the training pipeline convention.
 *
 * See: apps/mobile-deaf-user/src/model/mediapipe-adapter.ts for the adapter
 *      that maps these results into FrameLandmarks.
 */

import { NativeModulesProxy, EventEmitter, Subscription } from "expo-modules-core";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  /** Anatomically-correct handedness: "Left" or "Right" (signer's perspective). */
  handedness: "Left" | "Right";
  /** 21 landmarks in MediaPipe order (0 = wrist). */
  landmarks: HandLandmark[];
  /** Detection score 0-1. */
  score: number;
}

export interface HandLandmarkerResult {
  /** Up to 2 detected hands, in detection order (not guaranteed left-first). */
  hands: DetectedHand[];
  /** Timestamp of the frame in milliseconds. */
  timestampMs: number;
}

export interface HandLandmarkerOptions {
  /** 1 or 2. Default: 2. */
  numHands?: number;
  /** Minimum detection confidence 0-1. Default: 0.5. */
  minHandDetectionConfidence?: number;
  /** Minimum tracking confidence 0-1. Default: 0.5. */
  minHandPresenceConfidence?: number;
  /** Minimum presence confidence 0-1. Default: 0.5. */
  minTrackingConfidence?: number;
}

// --------------------------------------------------------------------------
// Native module proxy
// --------------------------------------------------------------------------

const NativeModule = NativeModulesProxy.ExpoHandLandmarker;

/**
 * Submit a camera frame for processing.
 *
 * @param base64Jpeg  Base64-encoded JPEG image data.
 * @param isFrontCamera  True when the front (selfie) camera is active — affects
 *                       handedness label correction (see handedness contract above).
 * @param timestampMs  Frame timestamp in milliseconds (use Date.now() if unavailable).
 *
 * Results are delivered asynchronously via the "onHandLandmarkerResult" event.
 * This function returns immediately.
 */
export async function processFrame(
  base64Jpeg: string,
  isFrontCamera: boolean,
  timestampMs: number,
): Promise<void> {
  if (!NativeModule) return;
  return NativeModule.processFrame(base64Jpeg, isFrontCamera, timestampMs);
}

/**
 * Initialise the MediaPipe HandLandmarker with the given options.
 * Must be called before startDetection(). Safe to call multiple times
 * (subsequent calls update options and reinitialise the detector).
 *
 * @param options  Configuration. Defaults are production-ready.
 * @returns Promise that resolves when the detector is ready.
 */
export async function initHandLandmarker(
  options: HandLandmarkerOptions = {},
): Promise<void> {
  if (!NativeModule) return; // web / iOS graceful no-op
  return NativeModule.initHandLandmarker({
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    ...options,
  });
}

/**
 * Release the HandLandmarker and free its memory.
 * Call when the session ends.
 */
export async function destroyHandLandmarker(): Promise<void> {
  if (!NativeModule) return;
  return NativeModule.destroyHandLandmarker();
}

/**
 * True when the native module is available in this build.
 * False on web, iOS (not yet implemented), and Expo Go.
 */
export function isHandLandmarkerAvailable(): boolean {
  return !!NativeModule;
}

// --------------------------------------------------------------------------
// Event subscription
// --------------------------------------------------------------------------

/**
 * Emitted each time a camera frame is analysed by the hand detector.
 * Subscribe in the camera frame loop. The event fires at camera rate
 * (typically 30 fps) whether or not hands are detected.
 */
export const HAND_RESULT_EVENT = "onHandLandmarkerResult";

let _emitter: EventEmitter | null = null;

function getEmitter(): EventEmitter {
  if (!_emitter && NativeModule) {
    _emitter = new EventEmitter(NativeModule);
  }
  if (!_emitter) throw new Error("ExpoHandLandmarker native module not available.");
  return _emitter;
}

export function addHandResultListener(
  listener: (result: HandLandmarkerResult) => void,
): Subscription {
  return getEmitter().addListener(HAND_RESULT_EVENT, listener);
}

export { Subscription };
