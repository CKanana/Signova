import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
export function signAccessToken(payload) {
    return jwt.sign({ ...payload, scope: "full" }, config.jwt.accessSecret, {
        expiresIn: config.jwt.accessTtl,
    });
}
export function signChallengeToken(userId, scope) {
    return jwt.sign({ sub: userId, scope }, config.jwt.challengeSecret, {
        expiresIn: config.jwt.challengeTtl,
    });
}
export function verifyAccessToken(token) {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (decoded.scope !== "full") {
        throw new Error("TOKEN_SCOPE_INVALID");
    }
    return decoded;
}
export function verifyChallengeToken(token) {
    const decoded = jwt.verify(token, config.jwt.challengeSecret);
    if (decoded.scope !== "2fa" && decoded.scope !== "mfa_enroll") {
        throw new Error("TOKEN_SCOPE_INVALID");
    }
    return decoded;
}
//# sourceMappingURL=jwt.js.map