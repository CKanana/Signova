import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { listStaff, createStaff, updateStaff, setStaffActive, } from "../services/staffService.js";
import { resetTwoFactor } from "../services/authService.js";
import { paramId } from "../utils/params.js";
const createSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    password: z.string().min(10),
    role: z.enum(["STAFF", "ADMIN"]),
});
const updateSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
});
const activeSchema = z.object({ active: z.boolean() });
export const listStaffHandler = async (req, res) => {
    const staff = await listStaff(req.auth.orgId);
    res.json({ staff });
};
export const createStaffHandler = [
    validate({ body: createSchema }),
    async (req, res) => {
        const staff = await createStaff(req.auth.orgId, req.body, req);
        res.status(201).json({ staff });
    },
];
export const updateStaffHandler = [
    validate({ body: updateSchema }),
    async (req, res) => {
        const staff = await updateStaff(req.auth.orgId, paramId(req), req.body, req);
        res.json({ staff });
    },
];
export const setStaffActiveHandler = [
    validate({ body: activeSchema }),
    async (req, res) => {
        const staff = await setStaffActive(req.auth.orgId, paramId(req), req.body.active, req);
        res.json({ staff });
    },
];
export const resetStaff2FAHandler = async (req, res) => {
    await resetTwoFactor(paramId(req), req.auth.sub, req);
    res.json({ ok: true });
};
//# sourceMappingURL=staffController.js.map