export type Step =
  | "splash"
  | "welcome"
  | "method"
  | "tellers"
  | "waiting"
  | "text"
  | "connecting"
  | "permission"
  | "ready"
  | "live"
  | "translating"
  | "confirm"
  | "uncertain"
  | "sent"
  | "conversation"
  | "response"
  | "complete"
  | "settings"
  | "help"
  | "offline";

export type CommunicationMethod = "sign" | "text";

export interface Message {
  id: string;
  sender: "user" | "staff";
  text: string;
  timestamp: string;
  method?: "sign" | "text" | "speech";
  confidence?: number;
  animationUrl?: string | null;
  generationStatus?: "pending" | "generating" | "completed" | "failed";
  /** Phase 2: async text-to-ASL animation status. Optional and additive. */
  animation?: {
    status: "pending" | "ready" | "failed" | "skipped";
    url: string | null;
    durationMs: number | null;
    requestedAt: string | null;
    readyAt: string | null;
    error: string | null;
  } | null;
}

export interface StaffInfo {
  name: string;
  role: string;
  serviceDesk: string;
  counterNumber: string;
  avatarUrl?: string;
  isAvailable?: boolean;
}

export interface OrganisationInfo {
  name: string;
  shortName: string;
  welcomeMessage: string;
  serviceName: string;
  counterLabel: string;
  primaryColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
}

export interface AccessibilitySettings {
  largeText: boolean;
  highContrast: boolean;
  captions: boolean;
  visualAlerts: boolean;
  reduceMotion: boolean;
  language: string;
  /** Data-saver: when true, animations are not preloaded; user taps "Play animation". */
  dataSaver: boolean;
}

export interface RecogniserResult {
  results: { sign: string; probability: number }[];
  timingMs: number;
  top1?: string;
}

import type { TranslateResponse, Teller } from "./mobile";

export interface SessionContextValue {
  step: Step;
  previousStep: Step | null;
  method: CommunicationMethod;
  messages: Message[];
  currentDraft: string;
  detectedGloss: string;
  confidence: number;
  isHandsDetected: boolean;
  handLandmarks: HandLandmarksPerFrame | null;
  isConnected: boolean;
  sessionId: string | null;
  sessionStatus: "CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED" | null;
  sessionOwnerId: string | null;
  staff: StaffInfo;
  joinedTellerId: string | null;
  joinedAt: number | null;
  organisation: OrganisationInfo;
  accessibility: AccessibilitySettings;

  // Actions
  goToStep: (step: Step) => void;
  goBack: () => void;
  setMethod: (method: CommunicationMethod) => void;
  setStaff: (staff: StaffInfo) => void;
  setCurrentDraft: (text: string) => void;
  setDetectedGloss: (gloss: string, confidence?: number) => void;
  setHandsDetected: (detected: boolean) => void;
  sendMessage: (text: string, method?: "sign" | "text") => void;
  receiveStaffMessage: (text: string) => void;
  updateAccessibility: (settings: Partial<AccessibilitySettings>) => void;
  updateOrganisation: (org: Partial<OrganisationInfo>) => void;
  resetSession: () => void;

  // Phase 2 backend-backed actions
  tellers: Teller[];
  loadOrganisation: () => Promise<void>;
  loadTellers: () => Promise<void>;
  selectTeller: (teller: Teller) => Promise<boolean>;
  connectToSession: () => void;
  requestTranslation: () => Promise<TranslateResponse | null>;
  confirmAndSend: (text: string) => Promise<void>;
  /** Phase 2: request the animation again for one message. */
  retryAnimation: (sessionId: string, messageId: string) => Promise<void>;
  sendTextMessage: (text: string) => Promise<void>;
  endSession: () => Promise<void>;
  isCreatingSession: boolean;
  isTranslating: boolean;
  isLoadingOrg: boolean;
  isLoadingTellers: boolean;
  error: string | null;

  // M4b on-device recognition (skip when EXPO_PUBLIC_USE_MODEL=false)
  recognitionBackend: string;
  isRecognising: boolean;
  recogniseResult: RecogniserResult | null;
  recogniseError: string | null;

  // On-device hand landmarker (single shared browser instance).
  // Lives here so the camera screen and session context share one detector
  // instead of constructing two (which would double frame processing).
  isLandmarkerReady: boolean;
  isLandmarkerInitialising: boolean;
  landmarkerError: string | null;
  initialiseLandmarker: () => Promise<void>;
  destroyLandmarker: () => Promise<void>;
  processFrame: (videoElement: HTMLVideoElement, timestampMs: number) => void;

  // Frame callback wired to useHandLandmarker.onFrame (single shared detector).
  // handInfos reports per-hand handedness label, confidence score and the
  // anatomical slot (0 = left, 1 = right) the hand was written into.
  setFrameListener: (
    cb: (frame: HandLandmarksPerFrame, handInfos: HandInfo[]) => void,
  ) => void;

  recordDebugFrame: (detectMs: number) => void;
  exportLatencyCsv: () => string;
  deliveryStates: Record<string, "sending" | "sent" | "delivered" | "failed">;
  acceptSigned: (text: string) => Promise<void>;
  /** Record a completed sign's latency + outcome entry (see ADDENDUM). */
  recordSignLatency: (entry: Omit<SignLatencyEntry, "ts">) => void;
  /** Mark the last latency row as accepted by an explicit user tap. */
  markLastLatencyAccepted: (method: "accept" | "chip" | "typed") => void;
  /** Replace the recognise result held by the context (used by the screen). */
  setRecogniseResult: (
    result: {
      results: { sign: string; probability: number }[];
      timingMs: number;
    } | null,
  ) => void;
  debugMode: boolean;
  debugStats: {
    fps: number;
    detectMs: number;
    inferMs: number;
    bufferLen: number;
    top5: { sign: string; probability: number }[];
  };

  // Session recovery
  restoreCurrentSession: () => Promise<void>;
  endedByStaffWhileWaiting: boolean;
}

export interface HandLandmarkSlot {
  landmarks: Array<{ x: number; y: number; z: number }> | null;
}

export interface HandInfo {
  slot: 0 | 1 | null;
  label: "Left" | "Right" | null;
  score: number;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
}

/** Latency + outcome record for one completed sign attempt (see ADDENDUM). */
export interface SignLatencyEntry {
  ts: number;
  sessionId: string | null;
  state: "READY" | "SIGNING" | "TRANSLATING" | "RESULT";
  framesRecorded: number;
  handFrames: number;
  top1Label: string | null;
  top1Prob: number | null;
  top2Label: string | null;
  top2Prob: number | null;
  top3Label: string | null;
  top3Prob: number | null;
  accepted: boolean;
  acceptMethod: "accept" | "chip" | "retry" | "typed" | null;
  model: string;
  signMs: number | null;
  preprocessMs: number | null;
  inferMs: number | null;
  renderMs: number | null;
  resultLatencyMs: number | null;
  valid: boolean;
}

export interface HandLandmarksPerFrame {
  handLandmarks: [HandLandmarkSlot | null, HandLandmarkSlot | null];
}
