import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Stable, securely-persisted device identity for the Deaf-user kiosk.
 *
 * The backend keys Deaf-user records on this id (no login required — a Deaf
 * user never types a password at a service counter). Generating it once and
 * storing it in the device keychain/keystore means the same physical tablet
 * keeps a consistent identity across app restarts.
 */

const DEVICE_ID_KEY = "signova.device.id.v1";

/** In-memory cache so we read secure storage at most once per launch. */
let cached: string | null = null;

function generateId(): string {
  // A random, collision-resistant id. No PII.
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `dev-${time}-${rand}`;
}

/**
 * Return this device's persistent id, creating and storing it on first launch.
 * Falls back to an in-memory id if secure storage is unavailable (e.g. web).
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = generateId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // Secure storage unavailable (web/dev). Use a session-scoped fallback so
    // the app still runs; identity simply won't persist across launches here.
    if (!cached) cached = generateId();
    return cached;
  }
}

/** Whether the device id is persisted across launches on this platform. */
export function isDeviceIdPersistent(): boolean {
  return Platform.OS !== "web";
}
