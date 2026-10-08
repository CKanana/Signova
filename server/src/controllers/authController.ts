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
