// Captures the two 2x screens the film uses, from the deployed app.
// Writes into film/assets/art/. Run before `node render.mjs`.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE ?? "https://raizo07.github.io/freehold";
const OUT = "../film/assets/art";
mkdirSync(OUT, { recursive: true });

const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Live mode, so the film's "Live on testnet" caption is true.
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.goto(`${BASE}/?live=1`, { waitUntil: "networkidle0" });
await wait(3500);
await p.evaluate(() => document.querySelector(".bizcard")?.click());
await wait(2500);
await p.screenshot({ path: `${OUT}/screen-live.png`, fullPage: true });

// Phone: 390 CSS px at 2x = 780 px wide.
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await wait(900);
await p.screenshot({ path: `${OUT}/screen-phone.png`, fullPage: true });

console.log("captured screen-live.png and screen-phone.png");
await b.close();
