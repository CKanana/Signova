// useHandRecorder.ts — collects per-frame hand landmarks from the camera
// frame processor while the user is in the "Perform sign" step, stops on the
// existing stop action, and hands the resulting Float32Array to the
// recogniser.
//
// This is platform-safe: it only references the MediaPipe Hand Landmarker
// plugin types that the native layer passes in. The hook itself is pure
// React/JS with no native imports, so it unit-tests alongside preprocess.ts.

import { useCallback, useRef, useState } from "react";
import { landmarksToFloat32, type FrameLandmarks, CLIP_LEN } from "../model/preprocess";

/** Delay in ms between frame callbacks while recording. */
export const FRAME_INTERVAL_MS = 60; // ~16fps at 1000ms; tune to camera fps

/**
 * What the recorder captures.
 */
export interface Recording {
  /** Raw per-frame landmarks (for tests / inspection). */
  frames: FrameLandmarks[];
  /** The preprocessed Float32Array[60][126] ready for the model. */
  sequence: Float32Array;
  /** True once the target clip length has been reached. */
  isFull: boolean;
}

/**
 * Mutable hand-landmark frame the native MediaPipe Hand Landmarker plugin
 * writes into. The app receives this from the camera frame processor
 * (onFrameReceived / the native frame-handler callback) and passes it to the
 * recorder. Type mirrors the hand landmarker plugin output.
 */
export interface HandLandmarksPerFrame {
  handLandmarks?: {
    landmarks: Array<{ x: number; y: number; z: number }>;
  }[];
}

/**
 * Recorder hook. Keeps a ring buffer of the last CLIP_LEN frames and stops
 * recording when the caller signals (the existing stop action in the "Perform
 * sign" step).
 *
 * @param onFrame - called each time the native camera pipeline supplies a
 *                  new HandLandmarksPerFrame. Important: the native plugin
 *                  usually only delivers frames where a hand was detected;
 *                  frames with no hand are reported as zero-hand frames, so
 *                  the recorder must not drop them.
 * @param onStop  - called when the user's stop action fires. The hook then
 *                  finalises the clip and returns the recording.
 * @returns
 *   recording (populated after the first stop),
 *   isRecording (true while frames are flowing),
 *   start() (begin a new clip — must be called to record a second clip),
 *   stop() (finalise and run the model),
 *   reset() (clears the buffer and stops a live recording).
 */
export function useHandRecorder(
  onFrame: (frame: HandLandmarksPerFrame) => void,
  onStop: () => void,
) {
  const bufferRef = useRef<HandLandmarksPerFrame[]>([]);
  const isRecordingRef = useRef(false);

  const [recording, setRecording] = useState<Recording | null>(null);

  const reset = useCallback(() => {
    bufferRef.current = [];
    isRecordingRef.current = false;
    setRecording(null);
  }, []);

  const start = useCallback(() => {
    if (isRecordingRef.current) return;
    bufferRef.current = [];
    isRecordingRef.current = true;
    setRecording(null);
  }, []);

  const frameHandler = useCallback(
    (frame: HandLandmarksPerFrame) => {
      if (!isRecordingRef.current) return;
      // Tail-pad: drop frames older than CLIP_LEN.
      if (bufferRef.current.length >= CLIP_LEN) {
        bufferRef.current.shift();
      }
      bufferRef.current.push(frame);
      onFrame(frame);
    },
    [onFrame],
  );

  const stop = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    // Build the final recording. The model expects a fixed 60-frame clip;
    // pad with zero frames if we caught fewer.
    const frames = bufferRef.current.slice(0, CLIP_LEN);
    const padded = [...frames];
    while (padded.length < CLIP_LEN) {
      padded.push({ handLandmarks: [] });
    }

    const sequence = landmarksToFloat32(padded);
    const rec: Recording = {
      frames: padded,
      sequence,
      isFull: padded.length >= CLIP_LEN,
    };
    setRecording(rec);

    onStop();
    return rec;
  }, [onStop]);

  return {
    recording,
    isRecording: isRecordingRef.current,
    start,
    stop,
    reset,
    /** Push a frame from the native hand landmarker into the recording buffer. */
    pushFrame: frameHandler,
  };
}
