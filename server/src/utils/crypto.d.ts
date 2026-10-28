/** Encrypt a TOTP secret for at-rest storage. Output: base64(iv + tag + ciphertext). */
export declare function encryptSecret(plaintext: string): string;
/** Decrypt a value produced by encryptSecret. Throws if tampered. */
export declare function decryptSecret(payload: string): string;
/** Cryptographically strong random hex token (for refresh tokens). */
export declare function randomToken(bytes?: number): string;
/** Hash a refresh token for at-rest storage (sha256). */
export declare function hashToken(token: string): string;
