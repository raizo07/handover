import puppeteer from "puppeteer-core";
const BASE = process.env.BASE ?? "http://127.0.0.1:4179";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto(BASE, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 700));
const overflow = await p.evaluate(() => {
  const el = document.querySelector(".topbar-inner");
  return el ? el.scrollWidth - el.clientWidth : -1;
});
console.log("topbar overflow px (0 = fits):", overflow);
await p.screenshot({ path: "shots/22-mobile-topbar.png" });
await p.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "menu")?.click());
await new Promise((r) => setTimeout(r, 400));
const menu = await p.evaluate(() => [...document.querySelectorAll(".wallet-menu-item")].map((e) => e.textContent));
console.log("menu items:", menu.join(" | "));
await p.screenshot({ path: "shots/23-mobile-menu.png" });
await b.close();
