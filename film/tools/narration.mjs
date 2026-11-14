// Writes narration.txt: every caption line with its start time.
import { readFileSync, writeFileSync } from "node:fs";
const TL = JSON.parse(readFileSync(new URL("../timeline.json", import.meta.url)));
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const lines = TL.captions.map((c) => `${mmss(c.t)}  ${c.text}`);
writeFileSync(new URL("../narration.txt", import.meta.url), lines.join("\n") + "\n");
console.log(`${lines.length} lines -> narration.txt`);
