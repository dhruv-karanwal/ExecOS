// Renders report/ExecOS-Report.html to report/ExecOS-Report.pdf with page-number footers (headless Chrome, CDP).
import { spawn } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const profile = join(tmpdir(), `execos-pdf-${Date.now()}`);
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 50 && !t; i++) { await sleep(200); t = await fetch("http://127.0.0.1:9334/json").then((r) => r.json()).catch(() => null); }
const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); });
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => m.error ? rej(new Error(m.error.message)) : res(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });

await send("Page.enable");
await send("Page.navigate", { url: pathToFileURL(join(here, "ExecOS-Report.html")).href });
await sleep(4000); // fonts + images
const foot = `<div style="width:100%;font:8px 'Segoe UI',sans-serif;color:#64748B;padding:0 14mm;display:flex;justify-content:space-between"><span>ExecOS · Project Report</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
const { data } = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: "<span></span>", footerTemplate: foot });
writeFileSync(join(here, "ExecOS-Report.pdf"), Buffer.from(data, "base64"));
console.log("wrote ExecOS-Report.pdf");
ws.close(); chrome.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
