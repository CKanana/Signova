/**
 * Signova Administrator portal configuration.
 *
 * Vite inlines VITE_* values at build time. Production builds MUST set:
 *   VITE_API_URL        https://api.<SIGNOVA_DOMAIN>
 *   VITE_STAFF_APP_URL  https://teller.<SIGNOVA_DOMAIN>
 *   VITE_GOOGLE_CLIENT_ID (optional, enables Google sign-in)
 */

const FALLBACK_API_URL = "http://localhost:4000";
const FALLBACK_STAFF_APP_URL = "http://localhost:5173";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

const configuredApiUrl = import.meta.env?.VITE_API_URL as string | undefined;
const configuredStaffUrl = import.meta.env?.VITE_STAFF_APP_URL as string | undefined;

export const API_BASE_URL: string =
  configuredApiUrl !== undefined
    ? trimTrailingSlash(configuredApiUrl)
    : FALLBACK_API_URL;

export const STAFF_APP_URL: string =
  configuredStaffUrl !== undefined
    ? trimTrailingSlash(configuredStaffUrl)
    : FALLBACK_STAFF_APP_URL;
