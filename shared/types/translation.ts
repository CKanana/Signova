/**
 * Shared type contracts for the Signova system.
 *
 * The `Translation` type is the stable boundary between the application and
 * whatever produces sign→text output (the MOCK service today, the real
 * two-hand BiLSTM model in Phase 6). Application code depends ONLY on this
 * shape, never on how the value was produced.
 */

export type Role = "ADMIN" | "STAFF" | "DEAF_USER";

export type CommunicationMethod = "sign" | "text";

export type SessionStatus = "CONNECTING" | "ACTIVE" | "ENDED";

export type SessionEndReason =
  | "USER_ENDED"
  | "STAFF_ENDED"
  | "TIMEOUT"
  | "ERROR";

export type MessageSender = "USER" | "STAFF";

export type TellerStatus = "FREE" | "BUSY" | "OFFLINE";

/**
 * The translation contract. `alternatives` carries the model's top-k choices
 * with their confidences so the UI can offer retry/fallback on low confidence.
 */
export interface Translation {
  gloss: string;
  confidence: number; // 0..1
  alternatives: Array<{ gloss: string; confidence: number }>;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  sender: MessageSender;
  text: string;
  method: CommunicationMethod | "speech";
  confidence?: number;
  isConfirmed: boolean;
  timestamp: string;
}
