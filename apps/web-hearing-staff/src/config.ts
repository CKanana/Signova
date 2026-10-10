/**
 * Staff web configuration.
 *
 * The API base URL comes from VITE_API_URL so the staff build works on a
 * developer workstation (http://localhost:4000) and on an institutional
 * machine pointing at the real server. Physical testing from a phone must
 * use the server's LAN IP, exactly like the mobile app's
 * EXPO_PUBLIC_API_URL.
 */

const FALLBACK_API_URL = "http://localhost:4000";

export const API_BASE_URL: string =
  (typeof import.meta !== "undefined" && (import.meta.env?.VITE_API_URL as string | undefined)) ||
  FALLBACK_API_URL;
