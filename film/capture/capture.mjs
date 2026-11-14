#!/usr/bin/env node
/**
 * capture.mjs — scripted captures of the live site.
 *
 * 1920x1080 CSS at deviceScaleFactor 2 (3840x2160 frames), dark colour scheme,
 * recordVideo via page.screencast, slow eased scrolls, no cursor jitter.
 * Read-only: no sign-in, no transaction, no write to any network.
 *
 * Writes footage/<name>.webm and frames/<name>/0001.jpg (2560x1440, 30 fps).
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "https://raizo07.github.io/freehold";
const ROOT = new URL("..", import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(`${ROOT}footage`, { recursive: true });
mkdirSync(`${ROOT}frames`, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-device-scale-factor=2", "--hide-scrollbars"],
});

async function withPage(fn) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  // Toasts are UI noise in a cut; the receipt drawer carries the result.
  await page.addStyleTag({ content: ".toasts{display:none!important}" }).catch(() => {});
  try {
    return await fn(page);
  } finally {
    await page.close();
    await ctx.close();
  }
}

// eased scroll, no jitter
async function scrollTo(page, y, ms = 1800) {
  await page.evaluate(
    ({ y, ms }) =>
      new Promise((resolve) => {
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / ms);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          window.scrollTo(0, from + (y - from) * e);
          if (k < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { y, ms },
  );
}

async function click(page, needle, settle = 700) {
  const ok = await page.evaluate((n) => {
    const el = [...document.querySelectorAll("button, a")].find((x) =>
      (x.textContent ?? "").toLowerCase().includes(n),
    );
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.click();
    return true;
  }, needle);
  await wait(settle);
  return ok;
}

async function record(name, fn) {
  const webm = `${ROOT}footage/${name}.webm`;
  await withPage(async (page) => {
    await page.goto(fn.url ?? `${BASE}/`, { waitUntil: "networkidle0" });
    await wait(1400);
    if (fn.before) await fn.before(page);
    const rec = await page.screencast({ path: webm });
    await wait(300);
    await fn.run(page);
    await wait(400);
    await rec.stop();
  });
  mkdirSync(`${ROOT}frames/${name}`, { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", webm,
    "-vf", "fps=30,scale=2560:-2", "-q:v", "4", `${ROOT}frames/${name}/%04d.jpg`,
  ]);
  const n = execFileSync("sh", ["-c", `ls ${ROOT}frames/${name} | wc -l`]).toString().trim();
  console.log(`${name}: ${n} frames`);
}

/* 1 · marketplace — a slow drift across the cards */
await record("market", {
  url: `${BASE}/`,
  run: async (page) => {
    await wait(600);
    await scrollTo(page, 300, 1600);
    await wait(600);
    await scrollTo(page, 120, 1400);
    await wait(500);
  },
});

/* 2 · the charter — the cap is a number on chain, and it refuses */
await record("charter", {
  url: `${BASE}/b/biz-7`,
  before: async (page) => {
    await page.evaluate(() => document.querySelector('input[type="range"]')?.scrollIntoView({ block: "center" }));
    await wait(700);
  },
  run: async (page) => {
    await wait(500);
    const slider = await page.$('input[type="range"]');
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2, { steps: 26 });
    await page.mouse.up();
    await wait(700);
    await click(page, "propose change", 700);
    await click(page, "apply", 800);
    await click(page, "try an overspend", 300);
    await wait(2200);
  },
});

/* 3 · the hand-over — key, download gate, sign, two beats, settled */
await record("handover", {
  url: `${BASE}/b/biz-7/buy`,
  run: async (page) => {
    await wait(500);
    await click(page, "generate key", 600);
    await click(page, "download key file", 900);
    await click(page, "continue", 600);
    await click(page, "continue", 600);
    await click(page, "sign transfer", 400);
    await wait(3400);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(1200);
  },
});

/* 4 · live testnet — the registry reading real state */
await record("live", {
  url: `${BASE}/?live=1`,
  before: async (page) => wait(2600),
  run: async (page) => {
    await wait(600);
    await scrollTo(page, 260, 1500);
    await page.evaluate(() => document.querySelector(".bizcard")?.click());
    await wait(2600);
    await scrollTo(page, 620, 1600);
    await wait(600);
  },
});

await browser.close();
