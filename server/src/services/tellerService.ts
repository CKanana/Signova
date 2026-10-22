import { Teller } from "../models/teller.js";
import { NotFoundError, ConflictError, BadRequestError } from "../utils/errors.js";
import type { Types } from "mongoose";
import type { TellerStatus } from "../../../shared/types/translation.js";
import { reserveTeller, releaseTeller } from "./sessionService.js";

export async function listTellers(orgId: string | Types.ObjectId) {
  return Teller.find({ organization: orgId }).sort({ counterNumber: 1 });
}

export async function getTeller(orgId: string | Types.ObjectId, tellerId: string) {
  const teller = await Teller.findOne({ _id: tellerId, organization: orgId });
  if (!teller) throw new NotFoundError("Teller not found");
  return teller;
}

export async function getTellerByPairingCode(orgId: string | Types.ObjectId, pairingCode: string) {
  return Teller.findOne({ organization: orgId, pairingCode: pairingCode.toUpperCase() });
}

export async function createTeller(
  orgId: string | Types.ObjectId,
  data: { name: string; serviceLabel?: string; serviceDesk: string; counterNumber: string; staffUser?: string; pairingCode: string },
) {
  const existing = await Teller.findOne({ organization: orgId, pairingCode: data.pairingCode.toUpperCase() });
  if (existing) throw new ConflictError("Pairing code already in use");
  return Teller.create({ ...data, pairingCode: data.pairingCode.toUpperCase(), organization: orgId });
}

export async function updateTeller(
  orgId: string | Types.ObjectId,
  tellerId: string,
  updates: Partial<{ name: string; serviceLabel: string; serviceDesk: string; counterNumber: string; staffUser: string }>,
) {
  const teller = await Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId },
    updates,
    { new: true },
  );
  if (!teller) throw new NotFoundError("Teller not found");
  return teller;
}

export async function updateTellerAvailability(
  orgId: string | Types.ObjectId,
  tellerId: string,
  status: TellerStatus,
): Promise<import("../models/teller.js").ITeller> {
  if (status === "BUSY") {
    const booked = await reserveTeller(orgId, tellerId);
    if (!booked) throw new ConflictError("Teller is currently in a session");
    return booked;
  }
  // FREE / OFFLINE: release any live BUSY lease if present; do not
  // error when the teller is already FREE/ONLINE.
  await releaseTeller(orgId, tellerId);
  // Confirm the teller still exists (or the org-scoped query resolves it).
  const teller = await Teller.findById(tellerId);
  if (!teller) throw new NotFoundError("Teller not found");
  return teller;
}
