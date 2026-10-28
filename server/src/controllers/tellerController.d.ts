import type { Request, Response } from "express";
export declare const listTellersHandler: (req: Request, res: Response) => Promise<void>;
export declare const getTellerHandler: (req: Request, res: Response) => Promise<void>;
export declare const createTellerHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
export declare const updateTellerHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
export declare const availabilityHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
