/**
 * Client-side types mirroring the Signova backend responses.
 * Kept in shared/ so the mobile app and (later) the web dashboards stay in
 * sync with the server contract.
 */

import type { CommunicationMethod, Translation } from "./translation.js";

export interface Organisation {
  _id: string;
  name: string;
  shortName: string;
  welcomeMessage: string;
  serviceName: string;
  counterLabel: string;
  colors: { primary: string; background: string };
  logoUrl?: string;
  isActive: boolean;
}

export type TellerAvailability = "FREE" | "RESERVED" | "BUSY" | "OFFLINE";

export interface Teller {
  _id: string;
  name: string;
  serviceLabel: string;
  serviceDesk: string;
  counterNumber: string;
  status: TellerAvailability;
  pairingCode: string;
}

export interface SessionRecord {
  _id: string;
  organization: string;
  teller: string;
  deafUser: string;
  method: CommunicationMethod;
  status: "CONNECTING" | "ACTIVE" | "CANCELLED" | "ENDED";
  pairingCode: string;
  messageCount: number;
  startedAt: string;
}

export interface MessageRecord {
  _id: string;
  sessionId: string;
  sender: "USER" | "STAFF";
  text: string;
  method: CommunicationMethod | "speech";
  confidence?: number;
  isConfirmed: boolean;
  timestamp: string;
  /** Phase 2: URL of the generated 2D SignBridge MP4 (null until generation completes). */
  animationUrl: string | null;
  /** Phase 2: async generation status: pending | generating | completed | failed. */
  generationStatus: "pending" | "generating" | "completed" | "failed";
  /** Phase 2: full animation object (optional, additive). */
  animation?: {
    status: "pending" | "ready" | "failed" | "skipped";
    url: string | null;
    durationMs: number | null;
    requestedAt: string | null;
    readyAt: string | null;
    error: string | null;
  } | null;
}

/** Response envelope from POST /api/sessions/:id/translate. */
export interface TranslateResponse {
  translation: Translation;
  latencyMs: number;
  lowConfidence: boolean;
}

/** Response from POST /api/kiosk/sessions. */
export interface KioskSessionResponse {
  session: SessionRecord;
  accessToken: string;
  teller: Teller;
}
