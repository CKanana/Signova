import crypto from "node:crypto";
import { config } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard nonce size
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = config.totpEncryptionKey;
  // Accept hex (64 chars) or base64. Normalize to 32 bytes.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32) return b64;
  // Fall back to a deterministic 32-byte derivation (documented requirement: 32 bytes)
  return crypto.createHash("sha256").update(raw).digest();
}

/** Encrypt a TOTP secret for at-rest storage. Output: base64(iv + tag + ciphertext). */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Decrypt a value produced by encryptSecret. Throws if tampered. */
export function decryptSecret(payload: string): string {
  const key = getKey();
  const data = Buffer.from(payload, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Cryptographically strong random hex token (for refresh tokens). */
export function randomToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/** Hash a refresh token for at-rest storage (sha256). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
