// Captures report screenshots of the running ExecOS app via headless Chrome + CDP (Node 22 global WebSocket).
// Usage: node report/capture.mjs <token-json-file>   (frontend on :5173, backend on :8000 must be running)
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = new URL("./screenshots/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const APP = "http://localhost:5173/";
const session = readFileSync(process.argv[2], "utf8");
const W = 1440, H = 900, MAX_H = 2000;
mkdirSync(OUT, { recursive: true });

const profile = join(tmpdir(), `execos-cdp-${Date.now()}`);
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "--hide-scrollbars", "--force-dark-mode", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets;
for (let i = 0; i < 50 && !targets; i++) { await sleep(200); targets = await fetch("http://127.0.0.1:9333/json").then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => (await send("Runtime.evaluate", { expression: `(async()=>{${HELPERS};${expr}})()`, awaitPromise: true, returnByValue: true })).result?.value;

const HELPERS = `
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
const btn=(t)=>[...document.querySelectorAll('button,[role=tab],a')].find(b=>b.textContent.trim().includes(t));
const click=async(t)=>{const b=btn(t); if(!b) return 'missing:'+t; b.click(); await wait(500); return 'ok';};
const nav=async(t)=>{const b=[...document.querySelectorAll('.side-nav button')].find(b=>b.textContent.trim().endsWith(t)); if(!b) return 'missing nav '+t; b.click(); await wait(1200); return 'ok';};
const cat=async(t)=>{const b=[...document.querySelectorAll('.category-picker button')].find(b=>b.textContent.trim()===t); if(!b) return 'missing cat '+t; b.click(); await wait(900); return 'ok';};
const finish=async()=>{for(let i=0;i<300;i++){const b=btn('⏭ Next step'); if(!b||b.disabled) break; b.click(); await wait(25);} await wait(500); return 'ok';};
const api=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+JSON.parse(localStorage.getItem('execos-session')).token},body:JSON.stringify(b)}).then(r=>r.status);
const top=()=>{document.querySelectorAll('*').forEach(e=>{if(e.scrollTop)e.scrollTop=0}); window.scrollTo(0,0);};
`;

async function shot(name) {
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await js("top()"); await sleep(300);
  // Grow the viewport to the scrolled content so the whole page lands in one image (capped).
  const h = await js(`let extra=0; document.querySelectorAll('*').forEach(e=>{const o=getComputedStyle(e).overflowY; if((o==='auto'||o==='scroll')&&e.clientHeight>300) extra=Math.max(extra,e.scrollHeight-e.clientHeight);}); return Math.max(document.documentElement.scrollHeight, ${H}+extra);`);
  const height = Math.min(Math.max(h, H), MAX_H);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height, deviceScaleFactor: 1, mobile: false });
  await sleep(700);
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
  writeFileSync(join(OUT, `${name}.jpg`), Buffer.from(data, "base64"));
  console.log("shot", name, `${W}x${height}`, h > MAX_H ? "(cropped)" : "");
}

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: APP }); await sleep(2500);
await shot("01-login");

await js(`localStorage.setItem('execos-session', ${JSON.stringify(session)})`);
await send("Page.navigate", { url: APP }); await sleep(3500);

const steps = [
  ["02-overview", "await nav('Overview')"],
  ["03-sim-cpu", "await nav('Simulator'); await cat('CPU Scheduling'); await finish()"],
  ["04-sim-cpu-lesson", "await click('Continue to concept lesson')"],
  ["05-sim-cpu-quiz", "await click('Take the 20-question')"],
  ["06-sim-sync", "await cat('Process Synchronization')"],
  ["07-sim-disk", "await cat('Disk Scheduling'); await finish()"],
  ["08-sim-contiguous", "await cat('Memory Management'); await finish()"],
  ["09-sim-memory-techniques", "await cat('Memory Management Techniques')"],
  ["10-sim-page-replacement", "await cat('Page Replacement'); await finish()"],
  ["11-sim-paging-segmentation", "await cat('Paging & Segmentation')"],
  ["12-sim-deadlock", "await cat('Deadlock'); await finish()"],
  ["13-sim-file-allocation", "await cat('File Management'); await finish()"],
  ["14-sim-directories", "await cat('Hierarchical File Organization')"],
  ["15-sim-syscalls", "await cat('System Calls')"],
  ["16-sim-os-concepts", "await cat('OS Concepts')"],
  ["17-challenges", "await nav('Challenges')"],
  ["18-processes", "await nav('Processes')"],
  ["19-process-detail", "const r=document.querySelector('.main-workspace tbody tr'); r&&r.click(); await wait(1000)"],
  ["20-file-system", "await nav('File System')"],
  ["21-devices", "await nav('Devices')"],
  ["22-io", "await nav('I/O')"],
  ["23-ipc", "await nav('IPC')"],
  ["24-resources", "await nav('Resources'); await click(\"Run Banker's safety check\"); await wait(800)"],
  ["25-system", "await api('/api/kernel/ipc/send',{sender_pid:'P101',receiver_pid:'P102',message:'hello from init'}); await api('/api/kernel/interrupts/trigger',{interrupt_type:'Timer',pid:'P101',details:{source:'report'}}); await api('/api/kernel/scheduler/run',{algorithm:'round_robin',quantum:2}); await nav('System')"],
  ["26-interrupts", "await nav('Interrupts')"],
  ["27-syscalls", "await nav('System Calls')"],
  ["28-trace", "await nav('Execution Trace')"],
  ["29-terminal", "await nav('Terminal')"],
  ["30-execai", "await nav('ExecAI'); await wait(1500)"],
  ["30b-execai-engine", "await click('ExecAI · Live Engine'); await wait(1500)"],
  ["31-settings", "await nav('Settings')"],
];
const only = process.argv[3]?.split(",");
for (const [name, action] of steps) {
  const r = await js(action + "; return 'ok'").catch((e) => e.message);
  if (r !== "ok") console.log("step", name, "->", r);
  if (!only || only.includes(name)) await shot(name);
}

await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:8000/docs" }); await sleep(3000);
await shot("32-api-docs");

ws.close(); chrome.kill();
await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
