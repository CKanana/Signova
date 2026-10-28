import cors from "cors";
/** Secure HTTP headers. */
export declare function securityHeaders(): (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
/** CORS with an allowlist from env. */
export declare function corsMiddleware(): (req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void;
/** JSON body size limit. */
export declare function bodyLimit(): import("connect").NextHandleFunction;
