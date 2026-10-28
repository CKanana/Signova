import type { Request, Response } from "express";
export declare const createSessionHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
export declare const currentSessionHandler: (req: Request, res: Response) => Promise<void>;
export declare const getSessionHandler: (req: Request, res: Response) => Promise<void>;
export declare const listSessionsHandler: (req: Request, res: Response) => Promise<void>;
export declare const updateSessionStatusHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
