import type { Request, Response } from "express";
export declare const listMessagesHandler: (req: Request, res: Response) => Promise<void>;
export declare const sendMessageHandler: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
