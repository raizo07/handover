# FREEHOLD — the film

An 85-second demo film for FREEHOLD, built on a deterministic motion-and-sound framework:
paper `#F3F3F0`, ink `#141414`, and black redaction bars. 96 BPM, 34 bars, 85 seconds,
1920×1080 at 30 fps.

Two of the nine scenes are **recorded product moments** — the real UI, captured with
`web/scripts/record-demo.mjs` and replayed frame by frame under a camera that pushes between
keyframed boxes. Nothing in them is re-staged.

Every number in the picture comes from the product. Timings are on the musical grid, written
once by `plan.py`, and read by both the renderer and the score, so every hit you see is a hit
you hear.

```
plan.py ──► timeline.json ──┬──► film.js  (window.seek(t)) ──► render.mjs ──► out/freehold.mp4
                            └──► score.py (48 kHz stereo) ──► audio/score.wav ──┘
```

The engine is forked from the LeakBench film (same author, same house style); the content,
the scenario and the screens are FREEHOLD's.

## Build

```bash
npm ci                   # puppeteer-core, pointed at the system Chrome
node ../web/scripts/capture-film.mjs   # 2x screenshots into assets/art/
node ../web/scripts/record-demo.mjs    # records clips/*.webm from the deployed app
python3 plan.py          # writes timeline.json and src/timeline.js
python3 score.py         # writes audio/score.wav
node render.mjs          # frames -> out/freehold.mp4 (H.264 + AAC, -14 LUFS)
```

`node render.mjs --check` revisits frames out of order and compares them byte-for-byte:
`seek(t)` is a pure function of `t`, so a revisit must be identical. `--still 42.5` renders a
single PNG.

## The twelve scenes

| bars | scene | template | what it says |
|---|---|---|---|
| 0–2 | open | title | selling a business onchain gives the buyer a picture |
| 2–7 | handover | clip | **recorded**: key → sign → two beats → "You own it." |
| 7–11 | vault | chapter | minting creates a real sub-account on NEAR |
| 11–14 | charter | chapter | an agent with money, and a ceiling |
| 14–18 | refusal | clip | **recorded**: the cap is set, the agent tries 1.5×, E20 |
| 18–22 | halt | terminal | `halt` deletes the operator key; the next call is E23 |
| 22–25 | proof | counter | 32 tests, four of them deploying real wasm |
| 25–29 | name | name | FREEHOLD, revealed from under three bars |
| 29–34 | end | title | buy a going concern, not a keyring |

The two clips are the argument: they are the product, not a description of it.

## The clock

`BEAT = 0.625 s`, `BAR = 2.5 s`, 48 bars. `at(bar, beat) = bar*BAR + beat*BEAT`. Scenes start and
end on bar lines; events sit on beats, eighths, sixteenths and thirty-seconds. Typing runs at
`BEAT/16`. A beat counts as reached at `t + 0.5/fps`.

## The look

| layer | z | notes |
|---|---|---|
| paper + grain | 0–1 | grain is a 128 px tile at 0.07, behind the content |
| scene | 2 | sheets, type, bars |
| exit bars | 6 | scene ledges |
| mascot | 7 | the brand's bar with two eyes |
| wipe | 80 | 9 bars, 108 tall, every 120 px from y 6 |

Type: Archivo 800 at 72% width for display (`-0.012em`, line-height 0.9), 78% for words, IBM Plex
Mono for data. Sheets are white with a 1.5 px `#DAD9D3` border, radius 10 and a two-part shadow.
Bars are black, radius 6 (8 for wipe bars). Everything scales from its `(0, 60%)` point.

Colour is a vocabulary: green `#0B6B3A` only for a yes, red `#B3261E` only for the refusal.

## Rebuilding the frame

```
prog(t, start, dur) = clamp((t - start) / dur)
out3(k) = 1 - (1-k)^3      in3(k) = k^3
inout(k) = 4k^3 | 1 - (-2k+2)^3/2
back(k, s=1.7) = 1 + (s+1)(k-1)^3 + s(k-1)^2
pulse(t, c, h) = max(0, 1 - |t - c| / h)
```

Randomness is `mulberry32(2610)`, spent while building, never per frame.

## The clip template

`BUILD.clip` shows a pre-extracted frame sequence (`clips/<name>/0001.jpg`) inside a sheet,
scrubbed by `t`, with `frame_from` / `count` / `fps` deciding the window and a list of
keyframed camera boxes (`{t, x, y, w, dur}`) interpolated with `inout`. Frames come from
`page.screencast()` and `ffmpeg -vf fps=30`; the recording hides toasts so the cut has no
stray UI.

## Changes made to the fork

- `chapter` and `compare` take a configurable word size / grade prefix, so longer chapter
  words do not collide with the sheet.
- The `counter` label, the terminal window title and the receipt unit were hard-coded to
  LeakBench strings; they are now scene data (`label`, `window_title`, `unit`).
- `refusal` renders `key.label`, which the original ignored.
- The phone sheet scales its screenshot to the device width instead of assuming a 1× capture.
