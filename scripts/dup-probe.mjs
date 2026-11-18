import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { io } from "socket.io-client";
const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(),"signova_staff_ui.json"),"utf8"));
const text = "Duplicate probe " + Date.now();
const s = io("http://localhost:4000/signova", { auth:{token:cfg.staffToken}, transports:["websocket"], reconnection:false });
let count = 0;
s.on("connect", () => { console.log("connected"); s.emit("session:join",{sessionId:cfg.sessionId}); setTimeout(()=>{ console.log("emit once"); s.emit("message:send",{sessionId:cfg.sessionId,text,method:"speech"}); }, 500); });
s.on("message:new", m => { if (m.text===text) { count++; console.log("message:new", count, m.id); } });
s.on("message:acked", a => console.log("acked", a.messageId));
setTimeout(async()=>{ const r=await fetch(`http://localhost:4000/api/sessions/${cfg.sessionId}/messages`,{headers:{authorization:`Bearer ${cfg.deafToken}`}}); const b=await r.json(); const persisted=b.messages.filter(m=>m.text===text).length; console.log("counts", {events:count,persisted}); process.exit(0); }, 6000);
