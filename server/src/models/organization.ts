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
  /**
   * Public-registration email-domain policy.
   *
   * When `restrictRegistrationByDomain` is true, public staff registration
   * only accepts emails whose domain appears in `allowedEmailDomains`.
   * When false (the default), that organization accepts any valid email.
   *
   * This governs registration only — it never grants privileges, and role
   * assignment is always decided server-side (public registration is
   * always STAFF, never ADMIN).
   */
  restrictRegistrationByDomain: boolean;
  allowedEmailDomains: string[];
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
    restrictRegistrationByDomain: { type: Boolean, default: false },
    allowedEmailDomains: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Organization: Model<IOrganization> =
  mongoose.models.Organization ?? mongoose.model<IOrganization>("Organization", organizationSchema);
