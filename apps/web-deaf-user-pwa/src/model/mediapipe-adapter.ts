// mediapipe-adapter.ts — isolates the MediaPipe -> FrameLandmarks adapter.
//
// This is a PURE, platform-agnostic module. It has no React Native or native
// imports, so it can be unit-tested with tsx / node:test without installing
// any native module.
//
// Intended contract (matches the M6.2 trained pipeline):
//   Input  : one frame produced by MediaPipe's hand-landmarker (Tasks API),
//            carrying per-hand `category_name` handedness ("Left" / "Right").
//   Output : FrameLandmarks, where handLandmarks[0] = anatomical LEFT,
//            handLandmarks[1] = anatomical RIGHT, missing hands are nulls.
//
// The adapter is deliberately kept separate from preprocess.ts and from the
// camera pipeline. It is implemented and tested here, but it is NOT wired into
// useHandRecorder.ts / the camera yet (see the architecture comparison in
// M6_3_MEDIAPIPE_INTEGRATION_REPORT.md). Wiring is a later milestone.
//
// preprocess.ts stays unchanged: it already handles hands[0]=left,
// hands[1]=right with zero-filling for missing hands. The adapter guarantees
// that invariant BEFORE data ever reaches preprocess.ts.

import type { FrameLandmarks } from "./preprocess";

/**
 * MediaPipe handedness tag, as returned by the hand-landmarker's
 * `category_name` field ("Left" / "Right").
 */
export interface MediaPipeHandedness {
  category_name: string;
}

/**
 * One MediaPipe hand = 21 landmarks in MediaPipe's canonical order:
 * index 0 = wrist, 1..4 = thumb, 5..8 = index, 9..12 = middle,
 * 13..16 = ring, 17..20 = pinky, 21..22 = palm.
 */
export interface MediaPipeHandLandmark {
  landmarks: Array<{ x: number; y: number; z: number }>;
}

/**
 * One decoded frame from MediaPipe's hand-landmarker.
 */
export interface MediaPipeHandLandmarksFrame {
  handedness: MediaPipeHandedness[];
  landmarks: MediaPipeHandLandmark[];
}

/**
 * Frozen set of values MediaPipe's `category_name` can take for a hand.
 */
export const VALID_HANDEDNESS_LABELS = ["Left", "Right"] as const;

/**
 * Encode the range of full-hand confidence values known for MediaPipe
 * (0.0 - 1.0). Used as a sanity bound for the adapter's confidence field
 * when it is present; a value outside this range is treated as unexpected.
 */
export const HAND_CONFIDENCE_MIN = 0.0;
export const HAND_CONFIDENCE_MAX = 1.0;

/**
 * Convert a MediaPipe hand-landmarker frame into Signova's FrameLandmarks.
 *
 * Assignment rule (anatomical, from the signer's perspective):
 *   handLandmarks[0] = LEFT  (anatomical left hand)
 *   handLandmarks[1] = RIGHT (anatomical right hand)
 *
 * Missing hands are represented as null in the array so that
 * landmarksToFloat32() (which skips falsy hand entries) zero-fills the slot.
 *
 * Defence in depth: the function rejects anything it cannot map
 * deterministically to an anatomical hand. This is the required behaviour
 * because MediaPipe does NOT guarantee hands[0] is the left hand.
 *
 * @throws {Error} when handedness metadata is missing, when a handedness
 *         value is not "Left"/"Right", or when two hands share the same
 *         anatomical label (duplicate handedness).
 */
export function toFrameLandmarks(
  frame: MediaPipeHandLandmarksFrame,
): FrameLandmarks {
  const handedness = frame.handedness ?? [];
  const landmarks = frame.landmarks ?? [];
  const handLandmarks: Array<{ landmarks: Array<{ x: number; y: number; z: number }> } | null> =
    [null, null];

  let leftSeen = false;
  let rightSeen = false;

  for (let i = 0; i < landmarks.length; i++) {
    const handednessEntry = handedness[i];
    const label = handednessEntry?.category_name;

    // Reject missing handedness metadata outright - we cannot guarantee
    // anatomical assignment without it.
    if (label == null || label === "") {
      throw new Error(
        `Missing handedness metadata for hand[${i}]. MediaPipe must return ` +
          `category_name ("Left"/"Right") for every detected hand.`,
      );
    }

    // Reject unexpected handedness values.
    if (!VALID_HANDEDNESS_LABELS.includes(label as (typeof VALID_HANDEDNESS_LABELS)[number])) {
      throw new Error(
        `Unexpected handedness value "${label}" for hand[${i}]. ` +
          `Expected "Left" or "Right".`,
      );
    }

    // Reject duplicate handedness labels.
    if (label === "Left") {
      if (leftSeen) {
        throw new Error(
          `Duplicate handedness label "Left" for hand[${i}]. ` +
            `Only one anatomical left hand may be detected per frame.`,
        );
      }
      leftSeen = true;
      handLandmarks[0] = landmarks[i];
    } else if (label === "Right") {
      if (rightSeen) {
        throw new Error(
          `Duplicate handedness label "Right" for hand[${i}]. ` +
            `Only one anatomical right hand may be detected per frame.`,
        );
      }
      rightSeen = true;
      handLandmarks[1] = landmarks[i];
    }
  }

  return { handLandmarks } as unknown as FrameLandmarks;
}

/**
 * Dump a small, human-readable summary of how a frame maps to the contract.
 * Useful for tests and debugging; does not mutate input.
 */
export function describeFrameMapping(
  frame: MediaPipeHandLandmarksFrame,
): string {
  const handedness = frame.handedness ?? [];
  const landmarks = frame.landmarks ?? [];
  const labels = handedness.map((h, i) => ({
    hand: i,
    label: h?.category_name ?? "<missing>",
    count: (landmarks[i]?.landmarks?.length ?? 0),
  }));
  return JSON.stringify(labels);
}
