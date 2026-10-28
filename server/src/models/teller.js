import mongoose, { Schema } from "mongoose";
const tellerSchema = new Schema({
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    serviceLabel: { type: String, default: "" },
    serviceDesk: { type: String, required: true, trim: true },
    counterNumber: { type: String, required: true, trim: true },
    staffUser: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["FREE", "BUSY", "OFFLINE"], default: "FREE" },
    pairingCode: { type: String, required: true, uppercase: true, trim: true },
}, { timestamps: true });
tellerSchema.index({ organization: 1, pairingCode: 1 }, { unique: true });
tellerSchema.index({ organization: 1, status: 1 });
export const Teller = mongoose.models.Teller ?? mongoose.model("Teller", tellerSchema);
//# sourceMappingURL=teller.js.map