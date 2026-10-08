import { Teller } from "../models/teller.js";
import { NotFoundError, ConflictError, BadRequestError } from "../utils/errors.js";
import type { Types } from "mongoose";
import type { TellerStatus } from "../../../shared/types/translation.js";

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
) {
  if (!["FREE", "BUSY", "OFFLINE"].includes(status)) {
    throw new BadRequestError("Invalid teller status");
  }
  const teller = await Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId },
    { status },
    { new: true },
  );
  if (!teller) throw new NotFoundError("Teller not found");
  return teller;
}
