import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import type { Role } from "../../../shared/types/translation.js";

export type TokenScope = "full" | "2fa" | "mfa_enroll";

export interface AccessTokenPayload {
  sub: string; // user id
  orgId: string;
  role: Role;
  scope: TokenScope;
}
export interface ChallengeTokenPayload {
  sub: string;
  scope: "2fa" | "mfa_enroll";
}

type SignOptions = Parameters<typeof jwt.sign>[2];

export function signAccessToken(payload: Omit<AccessTokenPayload, "scope">): string {
  return jwt.sign({ ...payload, scope: "full" }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  } as SignOptions);
}

export function signChallengeToken(userId: string, scope: "2fa" | "mfa_enroll"): string {
  return jwt.sign({ sub: userId, scope }, config.jwt.challengeSecret, {
    expiresIn: config.jwt.challengeTtl,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwt.accessSecret) as jwt.JwtPayload &
    AccessTokenPayload;
  if (decoded.scope !== "full") {
    throw new Error("TOKEN_SCOPE_INVALID");
  }
  return decoded;
}

export function verifyChallengeToken(token: string): ChallengeTokenPayload {
  const decoded = jwt.verify(token, config.jwt.challengeSecret) as jwt.JwtPayload &
    ChallengeTokenPayload;
  if (decoded.scope !== "2fa" && decoded.scope !== "mfa_enroll") {
    throw new Error("TOKEN_SCOPE_INVALID");
  }
  return decoded;
}
