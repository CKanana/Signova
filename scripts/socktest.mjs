import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { io } from "socket.io-client";
const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(),"signova_ui_session.json"),"utf8"));
const s = io("http://localhost:4000/signova", { auth:{token:cfg.deafToken}, transports:["websocket"], reconnection:false });
s.on("connect", () => { console.log("connected", s.id); s.emit("session:join", { sessionId: cfg.sessionId }); });
s.on("session:connected", p => console.log("session:connected", p));
s.on("staff:message", m => { console.log("STAFF MESSAGE", JSON.stringify(m)); process.exit(0); });
s.on("message:animation", p => console.log("ANIM", JSON.stringify(p)));
s.on("error", e => console.log("ERR", e));
s.on("connect_error", e => console.log("CONNECT_ERR", e.message));
setTimeout(async () => {
  const r = await fetch(`http://localhost:4000/api/sessions/${cfg.sessionId}/messages`, { method:"POST", headers:{authorization:`Bearer ${cfg.staffToken}`,"content-type":"application/json"}, body: JSON.stringify({sender:"STAFF",text:"Hello",method:"speech"}) });
  console.log("send", r.status);
}, 1000);
setTimeout(() => { console.log("timeout, no message"); process.exit(1); }, 20000);
