import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { chromium } from "playwright";
const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(),"signova_staff_ui.json"),"utf8"));
const b = await chromium.launch(); const c = await b.newContext({viewport:{width:430,height:932}});
await c.addInitScript(({t,d,s})=>{localStorage.setItem("signova.accessToken",t);localStorage.setItem("signova.device.id.v1",d);localStorage.setItem("signova.session",JSON.stringify(s));},{t:cfg.deafToken,d:cfg.deviceId,s:{sessionId:cfg.sessionId,tellerId:cfg.tellerId,method:"text",createdAt:Date.now()}});
const p = await c.newPage(); p.on("pageerror",e=>console.log("ERR",e.message));
await p.goto("http://localhost:5175/text",{waitUntil:"domcontentloaded"}); await p.waitForTimeout(6000);
console.log("URL",p.url()); console.log((await p.evaluate(()=>document.body.innerText)).slice(0,1500));
console.log("inputs", await p.evaluate(()=>Array.from(document.querySelectorAll("input,textarea")).map(i=>({ph:i.placeholder,vis:!!(i.offsetParent)}))));
await p.screenshot({path:path.join(os.tmpdir(),"pwa-staff-debug.png"),fullPage:true}); await b.close();
