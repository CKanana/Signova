/** Create an ACTIVE text session with a deaf message for the staff-UI audit. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { config } from "../src/config/env.js";

async function main() {
  await mongoose.connect(config.mongodbUri);
  const { Organization } = await import("../src/models/organization.js");
  const { Teller } = await import("../src/models/teller.js");
  const { signAccessToken } = await import("../src/utils/jwt.js");

  const org = await Organization.findOne({ shortName: "KNH" });
  if (!org) throw new Error("KNH not found");
  const teller = await Teller.findOne({ organization: org._id, status: "FREE", staffUser: { $ne: null } });
  if (!teller) throw new Error("No FREE teller with a staff user");

  const deviceId = `ui-e2e-${Date.now()}`;
  const res = await fetch("http://localhost:4000/api/kiosk/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingCode: teller.pairingCode, method: "text", deviceId }),
  });
  if (!res.ok) throw new Error(`kiosk session failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as any;

  const staffToken = signAccessToken({ sub: teller.staffUser.toString(), orgId: org._id.toString(), role: "STAFF" });
  const accept = await fetch(`http://localhost:4000/api/sessions/${data.session._id}/accept`, {
    method: "POST",
    headers: { authorization: `Bearer ${staffToken}` },
  });
  if (!accept.ok) throw new Error(`accept failed: ${accept.status} ${await accept.text()}`);

  const deafSend = await fetch(`http://localhost:4000/api/sessions/${data.session._id}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${data.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ sender: "USER", text: "My card was declined", method: "sign", confidence: 0.92, isConfirmed: true }),
  });
  if (!deafSend.ok) throw new Error(`deaf send failed: ${deafSend.status} ${await deafSend.text()}`);

  const meRes = await fetch("http://localhost:4000/api/auth/me", {
    headers: { authorization: `Bearer ${staffToken}` },
  });
  if (!meRes.ok) throw new Error(`me failed: ${meRes.status} ${await meRes.text()}`);
  const me = (await meRes.json()) as any;

  const out = {
    sessionId: data.session._id,
    deafToken: data.accessToken,
    deviceId,
    staffToken,
    staffUser: me.user,
    tellerId: teller._id.toString(),
  };
  const outPath = path.join(os.tmpdir(), "signova_staff_ui.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`staff UI config written to ${outPath}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
