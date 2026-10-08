import mongoose, { Schema } from "mongoose";
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

const tellerSchema = new Schema<ITeller>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    serviceLabel: { type: String, default: "" },
    serviceDesk: { type: String, required: true, trim: true },
    counterNumber: { type: String, required: true, trim: true },
    staffUser: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["FREE", "BUSY", "OFFLINE"], default: "FREE" },
    pairingCode: { type: String, required: true, uppercase: true, trim: true },
  },
  { timestamps: true },
);

tellerSchema.index({ organization: 1, pairingCode: 1 }, { unique: true });
tellerSchema.index({ organization: 1, status: 1 });

export const Teller: Model<ITeller> = mongoose.models.Teller ?? mongoose.model<ITeller>("Teller", tellerSchema);
