import puppeteer from "puppeteer-core";
const BASE = process.env.BASE ?? "http://127.0.0.1:4179";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));

await p.setViewport({ width: 1440, height: 900 });
await p.goto(`${BASE}/judge`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
let t = await p.evaluate(() => document.body.innerText);
console.log("walkthrough mentions wallet:", /connect a wallet/i.test(t));
console.log("walkthrough mentions business key:", /business key/i.test(t));
console.log("has reset control:", /reset demo data/i.test(t));
await p.screenshot({ path: "shots/20-judge.png", fullPage: true });

// live mode: vault actions must be visibly locked
await p.goto(`${BASE}/?live=1`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 3500));
await p.evaluate(() => document.querySelector(".bizcard")?.click());
await new Promise((r) => setTimeout(r, 2000));
t = await p.evaluate(() => document.body.innerText);
const disabledHalt = await p.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.toLowerCase().includes("halt operator"));
  return b ? (b).disabled : null;
});
console.log("live: business-key chip:", /business key required/i.test(t));
console.log("live: halt disabled:", disabledHalt);
console.log("live: explains why:", /signed by the business key/i.test(t));
await p.screenshot({ path: "shots/21-live-locked.png", fullPage: true });

// mobile topbar
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
await p.screenshot({ path: "shots/22-mobile-topbar.png", fullPage: false });
console.log("errors:", errs.length, errs.slice(0, 2).join(" | "));
await b.close();
