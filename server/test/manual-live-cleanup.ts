/** Remove UI-audit sessions and free their tellers. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { config } from "../src/config/env.js";

async function main() {
  await mongoose.connect(config.mongodbUri);
  const { User } = await import("../src/models/user.js");
  const { Session } = await import("../src/models/session.js");
  const { Message } = await import("../src/models/message.js");
  const { SessionLog } = await import("../src/models/sessionLog.js");
  const { Teller } = await import("../src/models/teller.js");

  const devices = await User.find({ role: "DEAF_USER", phone: /^ui-e2e-/ }).select("_id");
  const ids = devices.map((d) => d._id);
  const sessions = ids.length ? await Session.find({ deafUser: { $in: ids } }) : [];
  const sessionIds = sessions.map((s) => s._id);

  const messages = sessionIds.length ? await Message.find({ session: { $in: sessionIds } }).select("_id") : [];
  const storageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "storage", "videos");
  for (const m of messages) {
    const f = path.join(storageDir, `${m._id}.mp4`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  if (sessionIds.length) {
    await Message.deleteMany({ session: { $in: sessionIds } });
    await SessionLog.deleteMany({ session: { $in: sessionIds } });
    const tellerIds = sessions.map((s) => s.teller);
    await Teller.updateMany({ _id: { $in: tellerIds } }, { $set: { status: "FREE" } });
    await Session.deleteMany({ _id: { $in: sessionIds } });
  }
  if (ids.length) await User.deleteMany({ _id: { $in: ids } });

  console.log(`removed sessions=${sessionIds.length} messages=${messages.length} users=${ids.length}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch { /* noop */ }
  process.exit(1);
});
