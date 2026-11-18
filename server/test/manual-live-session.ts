/** Create an ACTIVE live session for the UI audit. Prints JSON to stdout. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { config } from "../src/config/env.js";

async function main() {
  const method = (process.argv[2] as "sign" | "text") || "text";
  await mongoose.connect(config.mongodbUri);
  const { Organization } = await import("../src/models/organization.js");
  const { Teller } = await import("../src/models/teller.js");
  const { signAccessToken } = await import("../src/utils/jwt.js");

  const org = await Organization.findOne({ shortName: "KNH" });
  if (!org) throw new Error("KNH not found");
  const teller = await Teller.findOne({
    organization: org._id,
    status: "FREE",
    staffUser: { $ne: null },
  });
  if (!teller) throw new Error("No FREE teller with a staff user");

  const deviceId = `ui-e2e-${Date.now()}`;
  const res = await fetch("http://localhost:4000/api/kiosk/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingCode: teller.pairingCode, method, deviceId }),
  });
  if (!res.ok) throw new Error(`kiosk session failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;

  const staffToken = signAccessToken({
    sub: teller.staffUser.toString(),
    orgId: org._id.toString(),
    role: "STAFF",
  });
  const accept = await fetch(`http://localhost:4000/api/sessions/${data.session._id}/accept`, {
    method: "POST",
    headers: { authorization: `Bearer ${staffToken}` },
  });
  if (!accept.ok) throw new Error(`accept failed: ${accept.status} ${await accept.text()}`);

  const out = {
    sessionId: data.session._id,
    deafToken: data.accessToken,
    staffToken,
    deviceId,
    method,
    tellerId: teller._id.toString(),
    pairingCode: teller.pairingCode,
  };
  const outPath = path.join(os.tmpdir(), "signova_ui_session.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`session written to ${outPath}`);
  console.log(JSON.stringify(out, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
