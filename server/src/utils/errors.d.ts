/** Application error carrying an HTTP status code. */
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    details?: unknown | undefined;
    constructor(statusCode: number, message: string, code?: string, details?: unknown | undefined);
}
export declare class BadRequestError extends AppError {
    constructor(message?: string, details?: unknown);
}
export declare class UnauthorizedError extends AppError {
    constructor(message?: string, code?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
export declare class ConflictError extends AppError {
    constructor(message?: string);
}
export declare class TooManyRequestsError extends AppError {
    constructor(message?: string);
}
