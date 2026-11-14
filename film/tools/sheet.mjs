// Contact sheet: one frame per scene, tiled. Each frame carries its own scene
// counter and timecode in the corner chrome, so no extra label is needed.
// (This ffmpeg build has no drawtext filter, hence no burnt-in captions here.)
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).pathname;
const TL = JSON.parse(readFileSync(`${ROOT}timeline.json`));
mkdirSync(`${ROOT}out/sheet`, { recursive: true });

async function still(t, out) {
  execFileSync("node", ["render.mjs", "--still", String(t)], { cwd: ROOT, stdio: "ignore" });
  const name = `still-${String(t).replace(".", "_")}.png`;
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${ROOT}out/${name}`, "-vf", "scale=640:-2", out]);
}

function tile(files, cols, rows, out) {
  const args = ["-y", "-loglevel", "error"];
  files.forEach((f) => args.push("-i", f));
  const filt = files.map((_, i) => `[${i}:v]`).join("") +
    `concat=n=${files.length}:v=1:a=0[cat];[cat]tile=${cols}x${rows}:margin=12:padding=8:color=0x0a0b0d[out]`;
  args.push("-filter_complex", filt, "-map", "[out]", "-frames:v", "1", out);
  execFileSync("ffmpeg", args);
}

// scene sheet: the middle of each scene
const scenes = TL.scenes.map((s) => (s.start + s.end) / 2);
const files = [];
for (let i = 0; i < scenes.length; i++) {
  const f = `${ROOT}out/sheet/s${String(i + 1).padStart(2, "0")}.png`;
  await still(scenes[i], f);
  files.push(f);
}
tile(files, 3, Math.ceil(files.length / 3), `${ROOT}out/contact-sheet.png`);
console.log(`contact sheet: ${files.length} scenes -> out/contact-sheet.png`);

// detail sheet: the six moments the film argues with
const detail = [41.5, 63.0, 74.0, 88.0, 100.0, 125.0];
const dfiles = [];
for (let i = 0; i < detail.length; i++) {
  const f = `${ROOT}out/sheet/d${i}.png`;
  await still(detail[i], f);
  dfiles.push(f);
}
tile(dfiles, 3, 2, `${ROOT}out/detail-sheet.png`);
console.log(`detail sheet: ${detail.length} frames -> out/detail-sheet.png`);
