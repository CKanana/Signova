/**
 * Stable device identity for the Deaf-user kiosk (PWA port).
 *
 * The backend keys Deaf-user records on this id (no login required — a Deaf
 * user never types a password at a service counter). Generating it once and
 * persisting it in localStorage means the same device keeps a consistent
 * identity across PWA launches. Falls back to an in-memory id when
 * localStorage is unavailable (private/incognito modes).
 */

const DEVICE_ID_KEY = "signova.device.id.v1";

let cached: string | null = null;

function generateId(): string {
  // A random, collision-resistant id. No PII.
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `dev-${time}-${rand}`;
}

function storageAvailable(): boolean {
  try {
    const key = "__signova_storage_check__";
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  if (storageAvailable()) {
    try {
      const existing = localStorage.getItem(DEVICE_ID_KEY);
      if (existing) {
        cached = existing;
        return existing;
      }
      const fresh = generateId();
      localStorage.setItem(DEVICE_ID_KEY, fresh);
      cached = fresh;
      return fresh;
    } catch {
      // fall through to in-memory fallback
    }
  }

  if (!cached) cached = generateId();
  return cached;
}

export function isDeviceIdPersistent(): boolean {
  return storageAvailable();
}
