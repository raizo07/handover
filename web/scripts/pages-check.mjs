import puppeteer from "puppeteer-core";
const BASE = process.env.BASE ?? "http://127.0.0.1:4176/handover/";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await p.setViewport({ width: 1440, height: 900 });

await p.goto(BASE, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
let t = await p.evaluate(() => document.body.innerText);
console.log("demo: names render:", t.includes("Oja Coffee Works"), "| badge demo:", /DEMO/i.test(t));
await p.screenshot({ path: "shots/16-pages-demo.png" });

await p.goto(`${BASE}?live=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 3000));
t = await p.evaluate(() => document.body.innerText);
console.log("live: badge:", /TESTNET · LIVE/i.test(t), "| 2 businesses:", t.includes("Balogun Textiles"), "| no demo banner:", !t.includes("DEMO DATA"));
await p.screenshot({ path: "shots/17-pages-live.png" });

// deep link must survive a hard load (404.html fallback on Pages)
await p.goto(`${BASE}b/biz-7`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
t = await p.evaluate(() => document.body.innerText);
console.log("deep link /b/biz-7:", t.includes("Oja Coffee Works") && t.includes("TREASURY"));
console.log("console errors:", errs.length, errs.slice(0, 2).join(" | "));
await b.close();
