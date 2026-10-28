/**
 * Request logging. Never logs bodies/headers that could carry secrets
 * (tokens, passwords, OTP codes). Only method/url/status/duration.
 */
export declare function requestLogger(): (req: import("http").IncomingMessage, res: import("http").ServerResponse<import("http").IncomingMessage>, callback: (err?: Error) => void) => void;
