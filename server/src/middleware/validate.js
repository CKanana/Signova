import { ZodError } from "zod";
/**
 * Validate request body/params/query against zod schemas.
 * On success, parsed (coerced) values replace the originals on the request.
 */
export function validate(schemas) {
    return (req, _res, next) => {
        try {
            if (schemas.params) {
                req.params = schemas.params.parse(req.params);
            }
            if (schemas.query) {
                // Express 5 query is a getter; assign a plain parsed object.
                Object.defineProperty(req, "query", {
                    value: schemas.query.parse(req.query),
                    writable: true,
                    configurable: true,
                });
            }
            if (schemas.body) {
                req.body = schemas.body.parse(req.body);
            }
            next();
        }
        catch (err) {
            if (err instanceof ZodError)
                return next(err);
            next(err);
        }
    };
}
//# sourceMappingURL=validate.js.map