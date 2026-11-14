# FREEHOLD — the demo film

Built from the brief in this session. 132 s, 1920×1080, 60 fps, H.264 + AAC.
Seven scenes: hook → first contact → the core action → the mechanism → the proof →
a second business → close.

```
plan.py ──► timeline.json ──┬──► src/film.js (window.seek(t)) ──► render.mjs ──► out/handover-demo.mp4
                            └──► score.py (48 kHz) ──► audio/score.wav ───────────┘
capture/capture.mjs ──► footage/*.webm ──► frames/<clip>/*.jpg
tools/sheet.mjs ──► out/contact-sheet.png, out/detail-sheet.png
tools/narration.mjs ──► narration.txt
```

## Build

```bash
npm ci
node capture/capture.mjs     # read-only captures of the live site
python3 plan.py              # timeline.json + src/timeline.js
python3 score.py             # audio/score.wav
node render.mjs              # 7,920 frames -> out/handover-demo.mp4
node render.mjs --check      # prove seek(t) is pure
node tools/sheet.mjs         # contact + detail sheets
node tools/narration.mjs     # narration.txt
```

## Where things are

| path | what |
|---|---|
| `timeline.json` | the one clock: scenes, caption word times, sound events, music grid |
| `src/film.js` | the renderer: seven scene builders, wipes, captions, chrome |
| `src/style.css` | the look, entirely in the product's CSS tokens |
| `capture/capture.mjs` | scripted read-only captures (puppeteer-core, no Playwright here) |
| `footage/` | original webm captures |
| `frames/` | extracted frames, 2560×1440 at 30 fps |
| `data/` | the on-chain evidence behind every number |
| `REPORT.md` | what was made, where each number came from, concerns |

## Not the Tender pipeline

`films/tender-demo` does not exist on this machine. This project implements the same
architecture (one timeline for picture and sound) with the tools that are installed.
There is no voice: Kokoro and faster-whisper are not available offline. See
`REPORT.md` §3 and §8.
