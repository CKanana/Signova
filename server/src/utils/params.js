import { BadRequestError } from "./errors.js";
/**
 * Express 5 types path params as `string | string[] | undefined`.
 * Every route uses a single string id, so coerce and validate here.
 */
export function paramId(req, name = "id") {
    const raw = req.params[name];
    if (typeof raw !== "string" || raw.length === 0) {
        throw new BadRequestError(`Missing or invalid parameter: ${name}`);
    }
    return raw;
}
/** Read a string query param. */
export function queryString(req, name) {
    const raw = req.query[name];
    return typeof raw === "string" ? raw : undefined;
}
//# sourceMappingURL=params.js.map