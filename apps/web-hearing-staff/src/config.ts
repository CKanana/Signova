/**
 * Staff web configuration.
 *
 * The API base URL comes from VITE_API_URL so the staff build works on a
 * developer workstation (http://localhost:4000) and on an institutional
 * machine pointing at the real server. Physical testing from a phone must
 * use the server's LAN IP, exactly like the mobile app's
 * EXPO_PUBLIC_API_URL.
 */

const configuredApiUrl = import.meta.env?.VITE_API_URL as string | undefined;

/**
 * Production builds must provide VITE_API_URL (https://api.<SIGNOVA_DOMAIN>).
 * When it is absent the app uses same-origin requests, which is correct for
 * the Vite dev proxy and fails loudly rather than silently calling localhost
 * from an installed/deployed build.
 */
export const API_BASE_URL: string = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, "")
  : "";
