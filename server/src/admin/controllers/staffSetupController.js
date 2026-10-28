import { z } from "zod";
import { acceptStaffSetup, activateStaffSetup } from "../services/staffSetupService.js";
const acceptSchema = z.object({
    token: z.string().min(1, "Setup token is required"),
    password: z.string().min(12, "Password must be at least 12 characters"),
});
export async function acceptStaffSetupHandler(req, res) {
    const body = acceptSchema.parse(req.body);
    const passwordErrors = (await import("../../utils/passwordPolicy.js")).validatePasswordPolicy(body.password).reasons;
    if (passwordErrors.length > 0) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: passwordErrors[0], details: passwordErrors } });
        return;
    }
    const result = await acceptStaffSetup({ token: body.token, password: body.password });
    res.status(200).json(result);
}
const activateSchema = z.object({
    challengeToken: z.string(),
    code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});
export async function activateStaffSetupHandler(req, res) {
    const body = activateSchema.parse(req.body);
    const result = await activateStaffSetup(body.challengeToken, body.code);
    res.status(200).json(result);
}
//# sourceMappingURL=staffSetupController.js.map