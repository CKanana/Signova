/** Application error carrying an HTTP status code. */
export class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, message, code = "APP_ERROR", details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = "AppError";
    }
}
export class BadRequestError extends AppError {
    constructor(message = "Bad request", details) {
        super(400, message, "BAD_REQUEST", details);
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
        super(401, message, code);
    }
}
export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(403, message, "FORBIDDEN");
    }
}
export class NotFoundError extends AppError {
    constructor(message = "Not found") {
        super(404, message, "NOT_FOUND");
    }
}
export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(409, message, "CONFLICT");
    }
}
export class TooManyRequestsError extends AppError {
    constructor(message = "Too many requests") {
        super(429, message, "RATE_LIMITED");
    }
}
//# sourceMappingURL=errors.js.map