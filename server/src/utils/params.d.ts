import type { Request } from "express";
/**
 * Express 5 types path params as `string | string[] | undefined`.
 * Every route uses a single string id, so coerce and validate here.
 */
export declare function paramId(req: Request, name?: string): string;
/** Read a string query param. */
export declare function queryString(req: Request, name: string): string | undefined;
