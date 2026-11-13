// Records the two product moments as real motion, for the film.
// Demo build: the vault actions are what the demo authorises; the chain proof
// is shown separately. Writes clips/*.webm, converted to frames by the Makefile.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE ?? "https://raizo07.github.io/freehold";
const OUT = "../film/clips";
mkdirSync(OUT, { recursive: true });
mkdirSync("/tmp/handover-dl", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-device-scale-factor=2", "--hide-scrollbars"],
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const cdp = await browser.target().createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: "/tmp/handover-dl" });

async function freshPage() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  // Toasts are UI noise that reads as contradiction in a cut; the receipt drawer
  // already carries the result.
  await page.addStyleTag({ content: ".toasts{display:none!important}" }).catch(() => {});
  return page;
}

async function click(page, needle, settle = 700) {
  const ok = await page.evaluate((n) => {
    const el = [...document.querySelectorAll("button, a")].find((x) =>
      (x.textContent ?? "").toLowerCase().includes(n),
    );
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  }, needle);
  await wait(settle);
  return ok;
}

const ONLY = process.argv[2];

/* ---------------------------------------------------------------- clip A
   The charter refuses the operator: drag the cap, read the verdict, replay. */
if (!ONLY || ONLY === "a") {
  const page = await freshPage();
  await page.goto(`${BASE}/b/biz-7`, { waitUntil: "networkidle0" });
  await wait(1200);
  // park the pointer on the cap so the drag reads as a human gesture
  await page.evaluate(() => {
    document.querySelector('input[type="range"]')?.scrollIntoView({ block: "center" });
  });
  await wait(500);

  const rec = await page.screencast({ path: `${OUT}/clip-a.webm` });
  await wait(500);

  const slider = await page.$('input[type="range"]');
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + box.width * 0.62, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2, { steps: 24 });
  await page.mouse.up();
  await wait(700);

  // dragging only previews the verdict — the charter changes on propose + apply
  await click(page, "propose change", 700);
  await click(page, "apply", 900);

  // replay stays inside the cap by construction; the overspend is the real refusal
  await click(page, "try an overspend", 300);
  await wait(2200);

  await rec.stop();
  await page.close();
  console.log("clip-a recorded");
}

/* ---------------------------------------------------------------- clip B
   The hand-over: key, download gate, sign, two beats, "You own it." */
if (!ONLY || ONLY === "b") {
  const page = await freshPage();
  await page.goto(`${BASE}/b/biz-7/buy`, { waitUntil: "networkidle0" });
  await wait(1000);

  const rec = await page.screencast({ path: `${OUT}/clip-b.webm` });
  await wait(400);

  await click(page, "generate key", 600);
  await click(page, "download key file", 900);
  await click(page, "continue", 600);
  await click(page, "continue", 600);
  await click(page, "sign transfer", 400);
  // the demo applies the rotation 1.8 s after signing; wait past it, then settle
  await wait(3400);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await wait(1400);

  await rec.stop();
  await page.close();
  console.log("clip-b recorded");
}

await browser.close();
