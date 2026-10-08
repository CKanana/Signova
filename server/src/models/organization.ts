import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";

export interface IOrganization {
  _id: Schema.Types.ObjectId;
  name: string;
  shortName: string;
  welcomeMessage: string;
  serviceName: string;
  counterLabel: string;
  colors: { primary: string; background: string };
  logoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    shortName: { type: String, required: true, trim: true },
    welcomeMessage: { type: String, default: "" },
    serviceName: { type: String, default: "Customer Support" },
    counterLabel: { type: String, default: "Counter" },
    colors: {
      primary: { type: String, default: "#5B2A86" },
      background: { type: String, default: "#FFF8DC" },
    },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Organization: Model<IOrganization> =
  mongoose.models.Organization ?? mongoose.model<IOrganization>("Organization", organizationSchema);
