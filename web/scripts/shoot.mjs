// Screenshot + console-error harness. Dev-only; not part of the shipped bundle.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
});

const errors = [];
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

async function shot(path, file, vp = { width: 1440, height: 900 }, full = true) {
  await page.setViewport(vp);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: full });
  console.log(`shot ${file} <- ${path}`);
}

await shot("/", "01-marketplace");
await shot("/b/biz-7", "02-business");
await shot("/b/biz-7", "03-business-mobile", { width: 390, height: 844 });
await shot("/judge", "04-judge");
await shot("/keys", "05-keys");

// Interaction check: drag the cap down and read the verdict line.
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/b/biz-7`, { waitUntil: "networkidle0" });
await page.evaluate(() => {
  document.querySelector('input[type="range"]')?.scrollIntoView({ block: "center" });
});
await new Promise((r) => setTimeout(r, 400));
const slider = await page.$('input[type="range"]');
if (slider) {
  const box = await slider.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.12, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: `${OUT}/06-cap-dragged.png`, fullPage: false });
    const verdict = await page.evaluate(() => {
      const p = [...document.querySelectorAll("p")].find((el) => el.textContent?.includes("rejected (E20)"));
      if (p) return p.textContent;
      return [...document.querySelectorAll("p")]
        .map((e) => e.textContent ?? "")
        .filter((t) => t.includes("At "))
        .join(" | ") || "(verdict line not found)";
    });
    console.log(`verdict: ${verdict}`);
  }
}

// Interaction check: replay the operator and capture the receipt drawer.
await page.reload({ waitUntil: "networkidle0" });
const buttons = await page.$$("button");
for (const b of buttons) {
  const t = await page.evaluate((el) => el.textContent, b);
  if (t && t.includes("replay operator")) {
    await b.click();
    await new Promise((r) => setTimeout(r, 900));
    break;
  }
}
await page.screenshot({ path: `${OUT}/07-receipt.png`, fullPage: false });

console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
