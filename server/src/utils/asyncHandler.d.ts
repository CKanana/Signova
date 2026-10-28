import type { Request, RequestHandler } from "express";
/** Wrap an async route handler so rejected promises reach the error middleware. */
export declare function asyncHandler(fn: (req: Request, res: import("express").Response) => Promise<unknown>): RequestHandler;
