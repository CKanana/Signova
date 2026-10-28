/**
 * Unauthenticated kiosk endpoints for the Deaf-user mobile app.
 * Mounted under /api/kiosk. Exposes only non-sensitive org config and the
 * ability to create a session (which returns a device-scoped token).
 */
declare const router: import("express-serve-static-core").Router;
export default router;
