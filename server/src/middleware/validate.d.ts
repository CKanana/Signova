import type { RequestHandler } from "express";
import { type ZodTypeAny } from "zod";
interface Schemas {
    body?: ZodTypeAny;
    params?: ZodTypeAny;
    query?: ZodTypeAny;
}
/**
 * Validate request body/params/query against zod schemas.
 * On success, parsed (coerced) values replace the originals on the request.
 */
export declare function validate(schemas: Schemas): RequestHandler;
export {};
