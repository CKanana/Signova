/**
 * PUBLIC (unauthenticated) session creation for the mobile kiosk.
 *
 * A Deaf-user device has no login, so this endpoint resolves the kiosk org,
 * creates the session against the chosen teller, and returns a short-lived
 * DEAF_USER access token bound to the device's Deaf-user identity. The mobile
 * app uses that token for all subsequent session-scoped calls (messages,
 * translate, socket). The backend remains the source of truth for teller
 * availability — if the teller is BUSY, createSession throws 409 and the
 * mobile UI must handle it.
 */
export declare const publicCreateSessionHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
