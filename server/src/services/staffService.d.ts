import type { Request } from "express";
import type { Types } from "mongoose";
export declare function listStaff(orgId: string | Types.ObjectId): Promise<(import("mongoose").Document<unknown, {}, import("../models/user.js").IUser, {}, {}> & import("../models/user.js").IUser & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
})[]>;
export declare function createStaff(orgId: string | Types.ObjectId, data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: "STAFF" | "ADMIN";
}, req: Request): Promise<import("mongoose").Document<unknown, {}, import("../models/user.js").IUser, {}, {}> & import("../models/user.js").IUser & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function updateStaff(orgId: string | Types.ObjectId, userId: string, updates: Partial<{
    name: string;
    email: string;
    phone: string;
}>, req: Request): Promise<import("mongoose").Document<unknown, {}, import("../models/user.js").IUser, {}, {}> & import("../models/user.js").IUser & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function setStaffActive(orgId: string | Types.ObjectId, userId: string, active: boolean, req: Request): Promise<import("mongoose").Document<unknown, {}, import("../models/user.js").IUser, {}, {}> & import("../models/user.js").IUser & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
