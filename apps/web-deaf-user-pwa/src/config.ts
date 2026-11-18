/// <reference types="vite/client" />

/**
 * Signova PWA (Deaf-user) configuration.
 *
 * API base URL comes from VITE_API_URL so the same build works on localhost
 * and on the real server. For a physical Android phone on the same LAN, use
 * the server's LAN IP (localhost on the phone points at the phone itself):
 *
 *     VITE_API_URL=http://192.168.1.20:4000
 *
 * Development fallback is http://localhost:4000, which works on the dev
 * machine. The backend must allow the PWA origin via CORS_ORIGINS in
 * server/.env.
 */

const FALLBACK_API_URL = "http://localhost:4000";

/** M4b on-device toggle. Set VITE_USE_MODEL=true to enable the real TFLite
 *  model (LiteRT.js). Leave false for the mock placeholder. */
export const USE_MODEL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_USE_MODEL === "true");

const configuredApiUrl = import.meta.env?.VITE_API_URL;

/**
 * An explicitly empty VITE_API_URL means "same origin", which uses the Vite
 * dev proxy for /api and /socket.io. That is the reliable mode when the PWA
 * is opened from a phone through a forwarded port: the phone only needs the
 * frontend URL and Vite forwards API and websocket traffic to the host.
 */
export const API_BASE_URL: string =
  configuredApiUrl !== undefined
    ? configuredApiUrl.replace(/\/+$/, "")
    : FALLBACK_API_URL;

/**
 * Signing screen configuration (camera + capture + drawing + recognition).
 *
 * All values are deliberate defaults; tune LOW_CONFIDENCE_THRESHOLD against
 * real on-device outputs before shipping.
 */
export const SIGN_CONFIG = {
  // ---- Drawing (canvas overlay) ----
  /** Draw motion trails behind the wrist / index fingertip. */
  DRAW_TRAILS: true,
  /** Number of trail keypoints kept per tracked point. */
  TRAIL_LENGTH: 24,
  /** Show the handedness chip near each wrist. */
  SHOW_HANDEDNESS: true,
  /** EMA alpha for visual smoothing (drawing only; buffer/model values are raw). */
  EMA_ALPHA: 0.35,
  /** Joint radius (px, CSS pixels). */
  JOINT_RADIUS: 4,
  /** Fingertip radius (landmarks 4, 8, 12, 16, 20). */
  FINGERTIP_RADIUS: 5,
  /** Wrist radius (landmark 0). */
  WRIST_RADIUS: 6,
  /** Bone width (px). */
  BONE_WIDTH: 4.5,
  /** Soft ring radius around the active index fingertip. */
  FINGERTIP_RING_RADIUS: 10,

  // ---- Sequential signing state machine ----
  /** Allow automatic end-of-sign detection (default OFF: explicit Done signing). */
  AUTO_END_ENABLED: false,
  /** Minimum frames with at least one hand before Done signing is enabled. */
  MIN_FRAMES: 10,
  /** Hard cap on signing duration (seconds); after this, stop appending frames
   *  (keep most recent) and prompt the user to press Done signing. */
  MAX_SIGN_SECONDS: 8,
  /** Below this top-1 probability, do not auto-accept; show "I'm not sure"
   *  with candidate chips. Tune on real outputs. */
  LOW_CONFIDENCE_THRESHOLD: 0.5,

  // ---- Camera ----
  CAMERA_WIDTH: 640,
  CAMERA_HEIGHT: 480,
  CAMERA_FPS: 30,

  // ---- Teller-message pop-up ----
  /** When true, a new teller message opens the pop-up immediately even while
   *  the user is signing (mid-sign behaviour). When false, a banner is shown
   *  and the pop-up opens only on tap. */
  POPUP_INTERRUPTS_SIGNING: true,

  // ---- Hand landmarker confidence (MediaPipe selfie video) ----
  NUM_HANDS: 2,
  MIN_HAND_DETECTION_CONFIDENCE: 0.45,
  MIN_HAND_PRESENCE_CONFIDENCE: 0.45,
  MIN_TRACKING_CONFIDENCE: 0.45,

  // ---- Recognition ----
  /** Model output frames. */
  CLIP_LEN: 60,
  /** Values per frame (2 hands x 21 landmarks x 3 coords). */
  VALUES_PER_FRAME: 126,
  /** Inference timeout (ms) while in TRANSLATING. */
  INFERENCE_TIMEOUT_MS: 5000,
} as const;

export type SignConfig = typeof SIGN_CONFIG;
