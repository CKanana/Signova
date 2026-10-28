import type { Request, Response } from "express";
export declare const listStaffHandler: (req: Request, res: Response) => Promise<void>;
export declare const createStaffHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
export declare const updateStaffHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
export declare const setStaffActiveHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
export declare const resetStaff2FAHandler: (req: Request, res: Response) => Promise<void>;
