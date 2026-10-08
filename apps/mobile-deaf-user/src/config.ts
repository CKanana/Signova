/**
 * Signova mobile configuration.
 *
 * API base URL comes from the EXPO_PUBLIC_API_URL environment variable so the
 * same build works on simulators and physical devices. In Expo, env vars
 * prefixed with EXPO_PUBLIC_ are inlined at build time — set them in your shell
 * before `expo start`, e.g.:
 *
 *     EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 npx expo start
 *
 * Development fallback is http://localhost:4000, which works on iOS/Android
 * simulators and web. For a PHYSICAL device or Expo Go, localhost points at the
 * device itself, so you MUST use your computer's LAN IP address instead:
 *
 *     ipconfig            # Windows: find IPv4 Address (e.g. 192.168.1.20)
 *     ifconfig | grep inet # macOS/Linux
 *
 *     EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:4000 npx expo start
 *
 * The backend must also allow that origin via CORS_ORIGINS in server/.env.
 */

const FALLBACK_API_URL = "http://localhost:4000";

export const API_BASE_URL: string =
  (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL) || FALLBACK_API_URL;
