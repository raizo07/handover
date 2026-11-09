// End-to-end flow check: buy a business, settle the rotation, then halt the operator.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });
mkdirSync("/tmp/handover-downloads", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
const errors = [];
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: "/tmp/handover-downloads",
});

const clickText = async (needle) => {
  const handles = await page.$$("button, a");
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent?.trim() ?? "", h);
    if (t.includes(needle)) {
      await h.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await h.click();
      return true;
    }
  }
  throw new Error(`no clickable with text "${needle}"`);
};

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/b/biz-7/buy`, { waitUntil: "networkidle0" });

// 1 — account + generate key
await page.click("#acct", { clickCount: 3 });
await page.type("#acct", "collector.testnet");
await clickText("generate key");
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${OUT}/08-buy-step1.png`, fullPage: true });

// 2 — download the key, then continue
await clickText("download key file");
await new Promise((r) => setTimeout(r, 600));
await clickText("continue");
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${OUT}/09-buy-review.png`, fullPage: true });

// 3 — review -> sign
await clickText("continue");
await new Promise((r) => setTimeout(r, 300));
await clickText("sign transfer");
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${OUT}/10-buy-signing.png`, fullPage: true });

// 4 — settle (demo client applies the rotation after ~1.8s)
await new Promise((r) => setTimeout(r, 2600));
const settledText = await page.evaluate(() => document.body.innerText);
const settled = settledText.includes("You own it.");
await page.screenshot({ path: `${OUT}/11-buy-settled.png`, fullPage: true });

// back to the business, check the holder changed, then halt the operator
await page.goto(`${BASE}/b/biz-7`, { waitUntil: "networkidle0" });
const holderLine = await page.evaluate(() => {
  const row = [...document.querySelectorAll(".kv-row")].find((r) =>
    (r.querySelector(".kv-key")?.textContent ?? "").toLowerCase() === "holder",
  );
  return row?.textContent ?? "";
});

await clickText("halt operator");
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${OUT}/12-halted.png`, fullPage: true });

// the halt receipt is open; close it or its scrim swallows the next click
await clickText("close");
await new Promise((r) => setTimeout(r, 300));

await clickText("replay operator");
await new Promise((r) => setTimeout(r, 700));
const afterHalt = await page.evaluate(() => document.querySelector(".receipt")?.textContent ?? "");
await page.screenshot({ path: `${OUT}/13-halt-receipt.png`, fullPage: false });

console.log(`settled: ${settled}`);
console.log(`holder row: ${holderLine.replace(/\s+/g, " ").trim()}`);
console.log(`halted replay contains E23: ${afterHalt.includes("E23")}`);
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
