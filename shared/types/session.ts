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
}

export interface RecogniserResult {
  results: { sign: string; probability: number }[];
  timingMs: number;
  top1: string;
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
  isConnected: boolean;
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
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  resetRecorder: () => void;

  // On-device hand landmarker (single shared browser instance).
  // Lives here so the camera screen and session context share one detector
  // instead of constructing two (which would double frame processing).
  isLandmarkerReady: boolean;
  isLandmarkerInitialising: boolean;
  landmarkerError: string | null;
  initialiseLandmarker: () => Promise<void>;
  destroyLandmarker: () => Promise<void>;
  processFrame: (videoElement: HTMLVideoElement, timestampMs: number) => void;

  // Session recovery
  restoreCurrentSession: () => Promise<void>;
}
