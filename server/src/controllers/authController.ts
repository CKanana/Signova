import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import {
  login,
  verifyTwoFactor,
  startTwoFactorEnrollment,
  activateTwoFactorEnrollment,
  logout,
  refresh,
  getPublicUser,
  changePassword,
  registerStaff,
  requestPasswordReset,
  resetPassword,
} from "../services/authService.js";

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

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(10, "Password must be at least 10 characters"),
  passwordConfirmation: z.string(),
}).refine((d) => d.password === d.passwordConfirmation, {
  message: "Passwords do not match",
  path: ["passwordConfirmation"],
});

export const loginHandler = [
  validate({ body: loginSchema }),
  async (req: Request, res: Response) => {
    const result = await login(req.body.email, req.body.password, req);
    res.json(result);
  },
];

export const verifyTwoFactorHandler = [
  validate({ body: verifySchema }),
  async (req: Request, res: Response) => {
    const result = await verifyTwoFactor(req.body.challengeToken, req.body.code, req);
    res.json(result);
  },
];

export const enrollStartHandler = [
  validate({ body: enrollStartSchema }),
  async (req: Request, res: Response) => {
    const result = await startTwoFactorEnrollment(req.body.challengeToken);
    res.json(result);
  },
];

export const enrollActivateHandler = [
  validate({ body: enrollActivateSchema }),
  async (req: Request, res: Response) => {
    const result = await activateTwoFactorEnrollment(req.body.challengeToken, req.body.code, req);
    res.json(result);
  },
];

export const logoutHandler = [
  validate({ body: logoutSchema }),
  async (req: Request, res: Response) => {
    await logout(req.body.refreshToken, req);
    res.json({ ok: true });
  },
];

export const refreshHandler = [
  validate({ body: refreshSchema }),
  async (req: Request, res: Response) => {
    const tokens = await refresh(req.body.refreshToken);
    res.json(tokens);
  },
];

export const meHandler = async (req: Request, res: Response) => {
  const user = await getPublicUser(req.auth!.sub);
  res.json({ user });
};

export const changePasswordHandler = [
  validate({ body: changePwSchema }),
  async (req: Request, res: Response) => {
    await changePassword(req.auth!.sub, req.body.currentPassword, req.body.newPassword, req);
    res.json({ ok: true });
  },
];

export const registerHandler = [
  validate({ body: registerSchema }),
  async (req: Request, res: Response) => {
    const result = await registerStaff(
      {
        name: req.body.name,
        organizationId: req.body.organizationId,
        email: req.body.email,
        password: req.body.password,
      },
      req,
    );
    res.status(201).json(result);
  },
];

/** Generic, non-enumerable response shared by every outcome. */
const FORGOT_PASSWORD_MESSAGE =
  "If an eligible account exists for that email address, password-reset instructions will be sent.";

export const forgotPasswordHandler = [
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response) => {
    await requestPasswordReset(req.body.email, req);
    // Always the same response — never reveals whether an account exists.
    res.json({ message: FORGOT_PASSWORD_MESSAGE });
  },
];

export const resetPasswordHandler = [
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response) => {
    await resetPassword(req.body.token, req.body.password, req);
    // No session is issued — the user must sign in again and complete TOTP.
    res.json({ message: "Your password has been reset. Please sign in with your new password." });
  },
];
