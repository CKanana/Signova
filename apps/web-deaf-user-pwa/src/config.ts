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

export const API_BASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || FALLBACK_API_URL;
