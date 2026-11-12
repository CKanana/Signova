import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { login, verifyTwoFactor, startTwoFactorEnrollment, activateTwoFactorEnrollment, logout, refresh, getPublicUser, changePassword, registerStaff, requestPasswordReset, resetPassword, loginWithGoogle, } from "../services/authService.js";
import { assertPasswordPolicy } from "../utils/passwordPolicy.js";
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});
const verifySchema = z.object({
    challengeToken: z.string(),
    code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
const enrollStartSchema = z.object({ challengeToken: z.string() });
const enrollActivateSchema = z.object({
    challengeToken: z.string(),
    code: z.string().regex(/^\d{6}$/),
});
const logoutSchema = z.object({ refreshToken: z.string() });
const refreshSchema = z.object({ refreshToken: z.string() });
const changePwSchema = z.object({
    currentPassword: z.string().min(8),
    newPassword: z.string().min(10, "New password must be at least 10 characters"),
});
const registerSchema = z.object({
    name: z.string().min(2, "Enter your full name"),
    organizationId: z.string().min(1, "Select your organization"),
    // Trim before validating so padded input is accepted and normalized.
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(10, "Password must be at least 10 characters"),
    // UI convenience only — the backend validates `password` independently.
    passwordConfirmation: z.string().optional(),
}).refine((d) => d.passwordConfirmation === undefined || d.passwordConfirmation === d.password, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
});
const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
/**
 * Login with Google.
 *
 * Accepts two payload shapes and refuses any shape that lacks verifiable
 * identity information:
 *
 *   1. Server-side verification shape:  { googleIdToken }
 *      The frontend obtains a Google ID token (via Google Identity
 *      Services credential response or an OAuth 2.0 `code` exchange) and
 *      submits it here. This is THE only shape the server accepts for
 *      account matching — the verified `sub` claim from the token is what
 *      is matched against the provisioned `googleSub` field.
 *
 *   2. Authorization-response shape (Google Identity Services):
 *      { code, state }
 *      The OAuth 2.0 authorization response contains `code` + `state`. The
 *      frontend must exchange `code` for tokens server-side before calling
 *      this endpoint. The server never trusts `code` alone for identity.
 *
 * Any other shape returns 400 with a clear message.
 */
const loginWithGoogleSchema = z
    .object({
    // Primary shape: server-side verified Google ID token.
    googleIdToken: z.string().optional(),
    // Alternative shape (Google Identity Services): the OAuth 2.0
    // authorization response contains `code` + `state`; the frontend must
    // exchange `code` for an ID token server-side before calling this
    // endpoint. The server never trusts `code` alone for identity.
    code: z.string().optional(),
    state: z.string().optional(),
})
    .superRefine((data, ctx) => {
    const hasToken = data.googleIdToken != null && data.googleIdToken.trim().length > 0;
    const hasCode = data.code != null && data.code.trim().length > 0;
    const hasState = data.state != null && data.state.trim().length > 0;
    if (hasToken)
        return;
    if (hasCode && hasState)
        return;
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either `googleIdToken` (ID token) or both `code` + `state` (authorization response).",
        path: ["googleIdToken", "code", "state"],
    });
});
export { loginWithGoogleSchema };
export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Reset token is required"),
    password: z.string().min(10, "Password must be at least 10 characters"),
    passwordConfirmation: z.string(),
}).refine((d) => d.password === d.passwordConfirmation, {
    message: "Passwords do not match",
    path: ["passwordConfirmation"],
});
export const loginHandler = [
    validate({ body: loginSchema }),
    async (req, res) => {
        const result = await login(req.body.email, req.body.password, req);
        res.json(result);
    },
];
export const loginWithGoogleHandler = [
    async (req, res) => {
        const token = req.body.googleIdToken;
        if (!token || typeof token !== "string" || !token.trim()) {
            res.status(400).json({ error: { code: "MISSING_ID_TOKEN", message: "Missing Google ID token." } });
            return;
        }
        const result = await loginWithGoogle(token.trim(), req);
        res.json(result);
    },
];
export const verifyTwoFactorHandler = [
    validate({ body: verifySchema }),
    async (req, res) => {
        const result = await verifyTwoFactor(req.body.challengeToken, req.body.code, req);
        res.json(result);
    },
];
export const enrollStartHandler = [
    validate({ body: enrollStartSchema }),
    async (req, res) => {
        const result = await startTwoFactorEnrollment(req.body.challengeToken);
        res.json(result);
    },
];
export const enrollActivateHandler = [
    validate({ body: enrollActivateSchema }),
    async (req, res) => {
        const result = await activateTwoFactorEnrollment(req.body.challengeToken, req.body.code, req);
        res.json(result);
    },
];
export const logoutHandler = [
    validate({ body: logoutSchema }),
    async (req, res) => {
        await logout(req.body.refreshToken, req);
        res.json({ ok: true });
    },
];
export const refreshHandler = [
    validate({ body: refreshSchema }),
    async (req, res) => {
        const tokens = await refresh(req.body.refreshToken);
        res.json(tokens);
    },
];
export const meHandler = async (req, res) => {
    const user = await getPublicUser(req.auth.sub);
    res.json({ user });
};
export const changePasswordHandler = [
    validate({ body: changePwSchema }),
    async (req, res) => {
        assertPasswordPolicy(req.body.newPassword);
        await changePassword(req.auth.sub, req.body.currentPassword, req.body.newPassword, req);
        res.json({ ok: true });
    },
];
export const registerHandler = [
    validate({ body: registerSchema }),
    async (req, res) => {
        const result = await registerStaff({
            name: req.body.name,
            organizationId: req.body.organizationId,
            email: req.body.email,
            password: req.body.password,
        }, req);
        res.status(201).json(result);
    },
];
/** Generic, non-enumerable response shared by every outcome. */
const FORGOT_PASSWORD_MESSAGE = "If an eligible account exists for that email address, password-reset instructions will be sent.";
export const forgotPasswordHandler = [
    validate({ body: forgotPasswordSchema }),
    async (req, res) => {
        await requestPasswordReset(req.body.email, req);
        res.json({ message: FORGOT_PASSWORD_MESSAGE });
    },
];
export const rejectPublicRegistrationHandler = [
    validate({ body: z.object({}) }),
    async (_req, res) => {
        res.status(403).json({
            error: {
                code: "PUBLIC_REGISTRATION_DISABLED",
                message: "Public registration is disabled. Contact an administrator for an invitation.",
            },
        });
    },
];
export const resetPasswordHandler = [
    validate({ body: resetPasswordSchema }),
    async (req, res) => {
        await resetPassword(req.body.token, req.body.password, req);
        // No session is issued — the user must sign in again and complete TOTP.
        res.json({ message: "Your password has been reset. Please sign in with your new password." });
    },
];
