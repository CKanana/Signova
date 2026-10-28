import type { Request, Response } from "express";
import { z } from "zod";
export declare const settingsUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    shortName: z.ZodOptional<z.ZodString>;
    welcomeMessage: z.ZodOptional<z.ZodString>;
    serviceName: z.ZodOptional<z.ZodString>;
    counterLabel: z.ZodOptional<z.ZodString>;
    colors: z.ZodOptional<z.ZodObject<{
        primary: z.ZodString;
        background: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        background: string;
        primary: string;
    }, {
        background: string;
        primary: string;
    }>>;
    logoUrl: z.ZodOptional<z.ZodString>;
    restrictRegistrationByDomain: z.ZodOptional<z.ZodBoolean>;
    allowedEmailDomains: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    shortName?: string | undefined;
    welcomeMessage?: string | undefined;
    serviceName?: string | undefined;
    counterLabel?: string | undefined;
    colors?: {
        background: string;
        primary: string;
    } | undefined;
    logoUrl?: string | undefined;
    restrictRegistrationByDomain?: boolean | undefined;
    allowedEmailDomains?: string[] | undefined;
}, {
    name?: string | undefined;
    shortName?: string | undefined;
    welcomeMessage?: string | undefined;
    serviceName?: string | undefined;
    counterLabel?: string | undefined;
    colors?: {
        background: string;
        primary: string;
    } | undefined;
    logoUrl?: string | undefined;
    restrictRegistrationByDomain?: boolean | undefined;
    allowedEmailDomains?: string[] | undefined;
}>;
export declare function getOrgSettingsHandler(req: Request, res: Response): Promise<void>;
export declare function updateOrgSettingsHandler(req: Request, res: Response): Promise<void>;
export declare function getOverviewHandler(req: Request, res: Response): Promise<void>;
export declare function listStaffHandler(req: Request, res: Response): Promise<void>;
export declare function createStaffHandler(req: Request, res: Response): Promise<void>;
export declare function getStaffHandler(req: Request, res: Response): Promise<void>;
export declare function updateStaffHandler(req: Request, res: Response): Promise<void>;
export declare function setStaffActiveHandler(req: Request, res: Response): Promise<void>;
export declare function resetStaff2FAHandler(req: Request, res: Response): Promise<void>;
export declare function listPendingStaffHandler(req: Request, res: Response): Promise<void>;
export declare function listTellersHandler(req: Request, res: Response): Promise<void>;
export declare function getTellerHandler(req: Request, res: Response): Promise<void>;
export declare function createTellerHandler(req: Request, res: Response): Promise<void>;
export declare function updateTellerHandler(req: Request, res: Response): Promise<void>;
export declare function setTellerStatusHandler(req: Request, res: Response): Promise<void>;
export declare function assignStaffToTellerHandler(req: Request, res: Response): Promise<void>;
export declare function listSessionsHandler(req: Request, res: Response): Promise<void>;
export declare function getSessionHandler(req: Request, res: Response): Promise<void>;
export declare function listAuditLogsHandler(req: Request, res: Response): Promise<void>;
export declare function getAuditLogsCountHandler(req: Request, res: Response): Promise<void>;
