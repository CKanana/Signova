/** Argon2id hashing for passwords. */
export declare function hashPassword(plain: string): Promise<string>;
export declare function verifyPassword(hash: string, plain: string): Promise<boolean>;
/**
 * Issue a rotating refresh token. The raw token is returned to the client once;
 * only its sha256 hash is persisted. Rotation invalidates the previous token.
 */
export declare function issueRefreshToken(userId: string, ttlDays: number): Promise<string>;
/** Validate + rotate a refresh token atomically. Returns the associated userId. */
export declare function rotateRefreshToken(rawToken: string): Promise<string>;
/** Revoke a specific refresh token (logout). */
export declare function revokeRefreshToken(rawToken: string): Promise<void>;
/** Revoke all refresh tokens for a user (password change, 2FA reset, deactivation). */
export declare function revokeAllRefreshTokens(userId: string): Promise<void>;
