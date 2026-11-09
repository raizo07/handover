import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await p.goto(process.env.BASE ?? "http://127.0.0.1:4173/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 500));
await p.screenshot({ path: "shots/14-marketplace-mobile.png", fullPage: true });
console.log("ok");
await b.close();
