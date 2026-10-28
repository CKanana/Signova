/**
 * POST /api/sessions/:id/translate
 *
 * Calls the MOCK translation service and returns the shared `Translation`
 * contract. Phase 6 replaces only the service implementation — this endpoint
 * and the mobile client remain unchanged.
 */
export declare const translateHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
