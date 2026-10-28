import mongoose, { Schema } from "mongoose";
const organizationSchema = new Schema({
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
    bootstrapAdminEmail: { type: String },
    bootstrapAdminException: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
export const Organization = mongoose.models.Organization ?? mongoose.model("Organization", organizationSchema);
//# sourceMappingURL=organization.js.map