// Proves the live path: the app reads a deployed registry instead of fixtures.
import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await p.setViewport({ width: 1440, height: 900 });
await p.goto(process.env.BASE ?? "http://127.0.0.1:4174/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 2500));
const text = await p.evaluate(() => document.body.innerText);
await p.screenshot({ path: "shots/15-live.png", fullPage: true });
console.log("badge live:", /testnet · live|live/i.test(text));
console.log("shows real business name:", text.includes("Oja Coffee Works"));
console.log("demo banner absent:", !text.includes("DEMO DATA"));
console.log("no console errors:", errors.length === 0, errors.slice(0, 2).join(" | "));
await b.close();
