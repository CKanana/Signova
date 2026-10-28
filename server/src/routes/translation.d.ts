/**
 * Translation endpoint, mounted at /api/sessions/:id/translate.
 * Declared directly on the sessions router (not a sub-router with mergeParams)
 * so Express 5 matches it before the generic /:id and /:id/messages routes.
 */
declare const router: import("express-serve-static-core").Router;
export default router;
