import puppeteer from "puppeteer-core";
const BASE = process.env.BASE ?? "http://127.0.0.1:4177/";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
p.on("console", (m) => m.type() === "error" && errs.push("console: " + m.text()));
await p.setViewport({ width: 1440, height: 900 });
await p.goto(BASE, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 1200));

const btnHas = async (t) => p.evaluate((needle) => [...document.querySelectorAll("button")].some((b) => b.textContent?.toLowerCase().includes(needle)), t);
console.log("connect button present:", await btnHas("connect wallet"));

// open the modal
await p.evaluate(() => {
  const el = [...document.querySelectorAll("button")].find((b) => b.textContent?.toLowerCase().includes("connect wallet"));
  el?.click();
});
await new Promise((r) => setTimeout(r, 4000));
const text = await p.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? "(no dialog)");
console.log("dialog open:", text !== "(no dialog)");
console.log("dialog text:", text.replace(/\s+/g, " ").slice(0, 260));
await p.screenshot({ path: "shots/18-connect-modal.png" });
console.log("errors:", errs.length, errs.slice(0, 2).join(" | "));
await b.close();
