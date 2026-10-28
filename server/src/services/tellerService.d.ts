import type { Types } from "mongoose";
import type { TellerStatus } from "../../../shared/types/translation.js";
export declare function listTellers(orgId: string | Types.ObjectId): Promise<(import("mongoose").Document<unknown, {}, import("../models/teller.js").ITeller, {}, {}> & import("../models/teller.js").ITeller & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
})[]>;
export declare function getTeller(orgId: string | Types.ObjectId, tellerId: string): Promise<import("mongoose").Document<unknown, {}, import("../models/teller.js").ITeller, {}, {}> & import("../models/teller.js").ITeller & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function getTellerByPairingCode(orgId: string | Types.ObjectId, pairingCode: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/teller.js").ITeller, {}, {}> & import("../models/teller.js").ITeller & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}) | null>;
export declare function createTeller(orgId: string | Types.ObjectId, data: {
    name: string;
    serviceLabel?: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser?: string;
    pairingCode: string;
}): Promise<import("mongoose").Document<unknown, {}, import("../models/teller.js").ITeller, {}, {}> & import("../models/teller.js").ITeller & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function updateTeller(orgId: string | Types.ObjectId, tellerId: string, updates: Partial<{
    name: string;
    serviceLabel: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser: string;
}>): Promise<import("mongoose").Document<unknown, {}, import("../models/teller.js").ITeller, {}, {}> & import("../models/teller.js").ITeller & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function updateTellerAvailability(orgId: string | Types.ObjectId, tellerId: string, status: TellerStatus): Promise<import("../models/teller.js").ITeller>;
