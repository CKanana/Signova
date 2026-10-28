import { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { TellerStatus } from "../../../shared/types/translation.js";
export interface ITeller {
    _id: Schema.Types.ObjectId;
    organization: Schema.Types.ObjectId;
    name: string;
    serviceLabel: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser?: Schema.Types.ObjectId;
    status: TellerStatus;
    pairingCode: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Teller: Model<ITeller>;
