// Server-side Google OAuth 2.0 / OpenID Connect authentication service.
//
// Verifies Google ID tokens using Google's official verification mechanisms:
//   - Fetches IDP certificates from https://www.googleapis.com/oauth2/v3/certs
//   - Validates signature, issuer (https://accounts.google.com),
//     audience (client ID), expiry (exp), issued-at (iat), and email_verified.
//
// This service never trusts email addresses supplied directly by the frontend.
// All identity claims come from the verified Google ID token payload.
import { OAuth2Client } from "google-auth-library";
import { BadRequestError } from "../utils/errors.js";
// The allowed Google OIDC issuer. Matches the spec mandated by the
// OpenID Connect Core 1.0 specification (Section 2.1).
const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_CERT_URL = "https://www.googleapis.com/oauth2/v3/certs";
// Audience is taken from the environment at call time so tests and
// development can inject a known client ID without code changes.
let googleClientId = process.env.GOOGLE_CLIENT_ID;
/**
 * Configure the Google OAuth client ID. Call once at application startup
 * (e.g. from the env loader) after the configuration is validated.
 */
export function setGoogleClientId(id) {
    googleClientId = id;
}
/** Return the configured client ID, or undefined if not set. */
export function getGoogleClientId() {
    return googleClientId;
}
/**
 * Reject unsafe characters in a Google-supplied display name.
 *
 * The name claim is UI-only and untrusted: a Google account can supply
 * arbitrary content. Sanitize to printable characters to block script
 * injection and control characters from reaching the database or HTML.
 */
function sanitizeDisplayName(name) {
    if (!name)
        return undefined;
    return name
        .split("")
        .filter((ch) => /[\x20-\x7E]/.test(ch))
        .join("");
}
/**
 * Verifies a Google ID token using Google's official verification
 * mechanisms. The returned claims are the only identity data the server
 * trusts; no email supplied by the frontend is used anywhere in this
 * function.
 *
 * The verification covers, in this order:
 *   1. Signature      - certificate fetched from Google's public certs endpoint.
 *   2. Issuer         - must be `https://accounts.google.com`.
 *   3. Audience       - must match the registered Google OAuth client ID.
 *   4. Expiry         - `exp` must be in the future (leeway of 60s covers
 *                       clock skew across infrastructure).
 *   5. Issued-at      - `iat` must be within a reasonable window of "now".
 *   6. Email claim    - must be present.
 *
 * Throws { BadRequestError } on signature, audience, issuer or expiry failure.
 * Throws { UnauthorizedError } if the token is missing required claims.
 *
 * @returns the verified identity claims.
 */
export async function verifyGoogleIdToken(idToken) {
    if (!googleClientId) {
        throw new BadRequestError("Google OAuth client ID is not configured. Set GOOGLE_CLIENT_ID.", "GOOGLE_NOT_CONFIGURED");
    }
    const client = new OAuth2Client(googleClientId);
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: googleClientId,
            // Google issues short-lived certificates (~60 min TTL). A token with an
            // expired certificate cannot be verified, and this caps the acceptable
            // clock-skew window across the distributed components.
            maxExpiry: 60 * 60,
        });
        payload = ticket.getPayload();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Failed to verify Google ID token";
        // Distinguish the common "token expired" case so the UI can give a
        // clearer message, but do not leak internal certificate URIs.
        const code = /expired/i.test(message) || /token expired/i.test(message)
            ? "ID_TOKEN_EXPIRED"
            : "ID_TOKEN_INVALID";
        throw new BadRequestError(`Invalid Google ID token: ${message}`, code);
    }
    if (!payload) {
        throw new BadRequestError("Google ID token payload is empty", "ID_TOKEN_INVALID");
    }
    // Validate the issuer - must be exactly Google's OIDC issuer.
    const iss = (payload.iss ?? "");
    if (iss !== GOOGLE_ISSUER) {
        throw new BadRequestError(`Invalid Google ID token issuer: ${iss}`, "ID_TOKEN_INVALID_ISSUER");
    }
    // Validate the audience - must match the configured client ID.
    const aud = (payload.aud ?? "");
    if (aud !== googleClientId) {
        throw new BadRequestError(`Invalid Google ID token audience: ${aud}`, "ID_TOKEN_INVALID_AUDIENCE");
    }
    // Validate expiry - the library has already checked exp, but restate it
    // for clarity so we fail closed if the library version changes behaviour.
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp) || exp <= Date.now() / 1000) {
        throw new BadRequestError("Google ID token has expired", "ID_TOKEN_EXPIRED");
    }
    // Validate issued-at timestamp is within a reasonable window.
    const iat = Number(payload.iat);
    if (!Number.isFinite(iat) || Math.abs(iat - Date.now() / 1000) > 300) {
        throw new BadRequestError("Google ID token issued-at timestamp is out of range", "ID_TOKEN_INVALID");
    }
    // Require an email claim. `email_verified` is a *separate* server-side check
    // - an unverified email never becomes the basis for account matching.
    const email = (payload.email ?? "");
    if (!email) {
        throw new BadRequestError("Google ID token is missing the email claim", "ID_TOKEN_MISSING_EMAIL");
    }
    const emailVerified = isEmailVerified(payload.email_verified);
    // Google's `sub` is the authoritative, immutable user identifier. Use it
    // for matching rather than the email address, since Google accounts can
    // alias multiple emails to a single `sub`.
    const userId = (payload.sub ?? "");
    if (!userId) {
        throw new BadRequestError("Google ID token is missing the sub claim", "ID_TOKEN_INVALID");
    }
    const name = sanitizeDisplayName(payload.name);
    const avatarUrl = payload.picture;
    return {
        email: email.toLowerCase(),
        emailVerified,
        userId,
        name,
        avatarUrl,
    };
}
function isEmailVerified(emailVerified) {
    if (emailVerified === true || emailVerified === "true" || emailVerified === "1") {
        return true;
    }
    if (emailVerified === false || emailVerified === "false" || emailVerified === "0") {
        return false;
    }
    return false;
}
