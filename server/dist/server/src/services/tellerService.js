import { Teller } from "../models/teller.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { releaseTeller } from "./sessionService.js";
export async function listTellers(orgId) {
    return Teller.find({ organization: orgId }).sort({ counterNumber: 1 });
}
export async function getTeller(orgId, tellerId) {
    const teller = await Teller.findOne({ _id: tellerId, organization: orgId });
    if (!teller)
        throw new NotFoundError("Teller not found");
    return teller;
}
export async function getTellerByPairingCode(orgId, pairingCode) {
    return Teller.findOne({ organization: orgId, pairingCode: pairingCode.toUpperCase() });
}
export async function createTeller(orgId, data) {
    const existing = await Teller.findOne({ organization: orgId, pairingCode: data.pairingCode.toUpperCase() });
    if (existing)
        throw new ConflictError("Pairing code already in use");
    return Teller.create({ ...data, pairingCode: data.pairingCode.toUpperCase(), organization: orgId });
}
export async function updateTeller(orgId, tellerId, updates) {
    const teller = await Teller.findOneAndUpdate({ _id: tellerId, organization: orgId }, updates, { new: true });
    if (!teller)
        throw new NotFoundError("Teller not found");
    return teller;
}
export async function updateTellerAvailability(orgId, tellerId, status) {
    if (status === "BUSY") {
        // Explicit admin availability change: mark BUSY directly (a session
        // request, by contrast, reserves the teller as RESERVED first).
        const booked = await Teller.findOneAndUpdate({ _id: tellerId, organization: orgId, status: "FREE" }, { $set: { status: "BUSY" } }, { new: true });
        if (!booked)
            throw new ConflictError("Teller is currently in a session");
        return booked;
    }
    // FREE / OFFLINE: release any live RESERVED lease if present; do not
    // error when the teller is already FREE/OFFLINE.
    await releaseTeller(orgId, tellerId);
    // Confirm the teller still exists (or the org-scoped query resolves it).
    const teller = await Teller.findById(tellerId);
    if (!teller)
        throw new NotFoundError("Teller not found");
    return teller;
}
