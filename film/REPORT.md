# FREEHOLD — demo film: report

**What this is.** A 2:12 demo film for FREEHOLD, built from real captures of
<https://raizo07.github.io/handover/> wrapped in motion graphics. Seven scenes:
hook → first contact → the core action → the mechanism → the proof → a second
business → close. Output `out/handover-demo.mp4`, 1920×1080, 60 fps, H.264 + AAC.

**Read this first.** There is no `films/tender-demo` on this machine. I searched for it
and for every file the brief names (`voice.py`, `vo.json`, `lipsync.py`, `mix.py`,
`tools/captions.mjs`, `tools/events.mjs`, `tools/sheet.mjs`, `capture/capture.mjs`) and
for a project `CLAUDE.md`; none exist, and neither do Kokoro, faster-whisper or
Playwright. So this is not the Tender pipeline. It is the same *idea* — one timeline
driving picture and sound — built on what is installed here. The differences are listed
under "Deviations" rather than hidden.

---

## 1 · What was made

| | |
|---|---|
| File | `out/handover-demo.mp4` (18.6 MB) |
| Length | 2:12 (132.0 s), 66 bars at 120 BPM |
| Picture | 1920×1080, 60 fps, 7,920 frames, H.264 (CRF 17, yuv420p) |
| Sound | 48 kHz stereo AAC 256k, −14.4 LUFS integrated, −1.4 dBTP true peak (measured on the final MP4) |
| Scenes | 7, each ending on a bar line with a wipe |
| Captions | 28 lines, word-by-word reveal, one accent keyword per line |
| Sources | `data/sources.json`, raw RPC responses in `data/` |

The clock: `plan.py` writes `timeline.json`, which holds scenes, caption word times,
sound events and the music grid. `src/film.js` seeks it for the picture; `score.py`
synthesises the bed and the hits from the same events. `render.mjs` screenshots
`window.seek(t)` frame by frame and muxes with ffmpeg, applying `loudnorm=I=-14:TP=-1.5`.

## 2 · Footage

Captured with `capture/capture.mjs` (puppeteer-core + system Chrome, no Playwright
here): viewport 1920×1080 at deviceScaleFactor 2, dark colour scheme, `page.screencast`
as recordVideo, eased scrolls, toasts suppressed. Read-only — no sign-in, no transaction.

| clip | what it shows | frames |
|---|---|---|
| `market` | the marketplace, cards scrolling into frame | 199 |
| `charter` | dragging the cap, propose → apply, then an overspend refused with E20 | 217 |
| `handover` | buy flow: key, download gate, sign, two beats, "You own it." | 313 |
| `live` | `?live=1`: the deployed registry, real operator accounts | 218 |

Originals in `footage/*.webm`, frames in `frames/<clip>/` at 2560×1440, 30 fps. Every
clip is cut to the voice on beats, with camera keyframes onto the part being discussed
and punch-ins on the named numbers (`camera` and `punch` in `timeline.json`).

**Personal data.** No email, name or login code appears in any frame: the app shows
accounts, not people. The only human-readable identifiers are `raizo07.testnet` (the
team's own testnet deployer, already public in the repo) and `collector.testnet`, a
made-up demo account. Checked frame by frame across every cut.

## 3 · Voice

**There is no voice track, deliberately.** An earlier cut used macOS `say` (Samantha, 168 wpm)
because Kokoro is not installed. It read clearly but sounded synthetic, and a robotic narrator
lowers the film rather than raising it. It was removed. The narration now lives in the captions,
which are still written as rhyming couplets and still timed word by word from the timeline.

The Whisper verification step has nothing to transcribe, so it is not run.

## 4 · Where every number comes from

| On screen | Value | Source |
|---|---|---|
| two businesses | 2 | `nft_total_supply` on `reg.raizo07.testnet` |
| biz-7 caps | 0.50 / 2.00 NEAR | `get_rules` on `biz-7.reg.raizo07.testnet` (`data/rules-biz-7.json`) |
| biz-3 caps | 0.40 / 1.20 NEAR | `get_rules` on `biz-3.reg.raizo07.testnet` (`data/rules-biz-3.json`) |
| 32 tests | 13 + 15 + 4 | `cargo test` on both crates |
| 4 deploy real wasm | 4 | `contracts/vault/tests/sandbox.rs` |
| E20 refusal | real | recorded in the product, from the contract's own check |
| testnet, free tokens | true | RPC endpoint and faucet both testnet |

**Not shown in the footage, and therefore not drawn:** a wallet handshake (needs an
extension; no sign-in was performed), any write to the chain (every capture is
read-only), and any mainnet deployment (none exists).

## 5 · How to re-cut

Everything is data. Edit `timeline.json` (or `plan.py`, which generates it) and re-render:

- **timing** — a scene is `{start, end}` in seconds on the bar grid; captions carry
  `t`, `end` and per-word times; sound events carry `t`.
- **camera** — `camera: [{t, x, y, w, dur}]` in source pixels; `w` is the zoom.
- **punch-in** — add a time to `punch: [...]` to zoom 1.6× on a named number.
- **swapping a clip** — replace `footage/<name>.webm`, re-extract frames with the ffmpeg
  line in `capture.mjs`, and point the scene's `clip`/`frames` at it. One line.
- **music/EQ** — `score.py` (bed, hits) and the `loudnorm` line in `render.mjs`.

Then: `python3 plan.py && python3 score.py && node render.mjs`.
`node render.mjs --check` must print *seek() is pure*; `node render.mjs --still 34`
renders one frame.

## 6 · The look

Dark throughout, colour only from the product's CSS tokens (`--bg #0a0b0d`, `--panel
#121418`, `--raised #161a20`, `--line rgba(232,230,225,.09)`, `--text #e9e7e2`, `--muted
#9c9992`, `--accent #e6b264`). One accent: wipes, the keyword in each caption, the stamp,
the outline on the real UI. Type is the product's UI stack. The emphasised word should be
Instrument Serif italic per the brief; that font is not on this machine, so the brand mark
uses the serif that is (Georgia italic) — the only substitution.

Chrome: project top-left, format top-right, scene counter bottom-left, timecode
bottom-right, truth line bottom-centre from scene 2 (`NEAR testnet · free test tokens ·
two businesses live`). Wipes alternate diagonal bars and an iris, both in accent.

## 7 · Contact-sheet loop

Scored 1–10 (hook in first 2 s, readability at phone size, motion, variety, brand
accuracy, sound sync); three worst fixed, twice:

| pass | hook | phone | motion | variety | brand | sync | worst problem fixed |
|---|---|---|---|---|---|---|---|
| 1 | 6 | 5 | 7 | 6 | 7 | 6 | scenes rendered blank (inline `display:none` beat the class) |
| 2 | 7 | 6 | 7 | 7 | 8 | 7 | captions painted under the footage (z-index) |
| 3 | 8 | 8 | 8 | 8 | 9 | 8 | purity failure from fractional-opacity text layers |

## 8 · Concerns

1. **No voice.** The single biggest gap against the brief. Captions carry the words, and
   the film is built to be watched muted, but a demo with a voice is warmer.
2. **Three-quarters product is closer to half.** 31 s of footage fills 78 s of a 132 s
   film; the rest is type, cards, the globe and the end card.
3. **The globe is decorative.** It carries no data — it is scale, not a claim.
4. **`--check` was intermittently failing** before `will-change` was added to the moving
   cards; it now passes three runs in a row, but this class of failure is timing-sensitive.
5. **Demo build, not live transactions.** The charter and handover clips run against the
   app's seeded demo data (the banner is visible in frame). The registry footage in scene
   6 is the real testnet registry.
