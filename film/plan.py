#!/usr/bin/env python3
"""plan.py — the single source of truth for the FREEHOLD film.

Writes timeline.json: scenes that start and end on bar lines, plus every event
on the musical grid. film.js draws from it and score.py plays from it, so every
hit in the picture is a hit in the sound.

96 BPM -> BEAT 0.625 s, BAR 2.5 s, 48 bars = 120 s.

The film follows the product: a business is an account, the token is the share,
and the moment that matters is the hand-over.
"""
import json
import pathlib

BPM = 96
BEAT = 60.0 / BPM          # 0.625
BAR = 4 * BEAT             # 2.5
EIGHTH = BEAT / 2
SIXTEENTH = BEAT / 4
THIRTY2 = BEAT / 8
FPS = 30
W, H = 1920, 1080
BARS = 34
DURATION = BARS * BAR      # 120.0


def at(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def r(x):
    return round(x, 6)


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return rnd


RND = mulberry32(2610)

SCENES = []
EVENTS = []


def scene(sid, start_bar, end_bar, template, **data):
    s = {
        "id": sid,
        "start": r(at(start_bar)),
        "end": r(at(end_bar)),
        "template": template,
        **data,
    }
    SCENES.append(s)
    return s


def ev(kind, t, **kw):
    e = {"kind": kind, "t": r(t), **{k: (r(v) if isinstance(v, float) else v) for k, v in kw.items()}}
    EVENTS.append(e)
    return e


def wipe(cut):
    ev("sweep", cut - 0.30, dur=0.55, lo=380, hi=3400, up=True, gain=0.24, pan=0.0)


def slam(t, gain=0.22, pan=0.0, w=0.5, target="", scene_id=""):
    ev("slam", t, gain=gain, pan=pan, w=w, target=target, scene=scene_id)


def typed(t0, text, per_char, level=1.0, pan=0.0, gain=0.10, scene_id=""):
    t = t0
    for i, ch in enumerate(text):
        ev("typekey", t, level=r(level * (0.75 + 0.25 * RND())), gain=gain, pan=pan,
           char=ch, index=i, scene=scene_id)
        t += per_char
    return t


# =========================================================================
# 1 · OPEN — 0..5 s  (the problem, in one breath)
# =========================================================================
s_open = scene(
    "open", 0, 2, "title",
    eyebrow="FREEHOLD · NEAR HACKATHON 2026 · TESTNET",
    eyebrow_t=-0.18,
    lines=[
        {"text": "Sell a business onchain,", "cls": "display", "size": 128, "t": -0.18, "top": 300},
        {"text": "the buyer gets a picture.", "cls": "display", "size": 128, "t": r(at(0, 2)), "top": 436},
    ],
    sub={"text": "So we made the business an account.", "t": r(at(1)), "top": 700},
    mascot={"enter": r(at(1, 2)), "x": 1530, "y": 730, "w": 250, "h": 108},
)
slam(at(0), target="eyebrow", scene_id="open")
for i, line in enumerate(s_open["lines"]):
    slam(line["t"], target=f"line{i}", scene_id="open")
slam(s_open["sub"]["t"], gain=0.16, target="sub", scene_id="open")
ev("sweep", at(1, 2) - 0.15, dur=0.4, lo=200, hi=1400, up=True, gain=0.16, pan=0.2)
ev("bloop", at(1, 2) + 1.2, f0=800, f1=1300, dur=0.05, gain=0.12, pan=0.2)

# =========================================================================
# 2 · THE FREEHOLD — 5..17.5 s  (recorded product moment)
# =========================================================================
s_hand = scene(
    "handover", 2, 7, "clip",
    heading="The handover",
    dir="../clips/b",
    count=270,
    frame_from=24,
    fps=30,
    frameW=1920,
    sheet={"x": 830, "y": 250, "w": 980, "h": 560},
    cues={
        "heading": r(at(2)),
        "play": r(at(2, 1)),
        "punch": r(at(6, 1)),
        "camera": [
            {"t": r(at(2, 1)), "x": 120, "y": 150, "w": 1780, "dur": 0.6},
            {"t": r(at(4)), "x": 150, "y": 520, "w": 1180, "dur": 1.0},
            {"t": r(at(5, 2)), "x": 150, "y": 520, "w": 1120, "dur": 0.8},
        ],
    },
    lines=[
        {"text": "A key is generated in the browser.", "t": r(at(4, 1)), "top": 860},
        {"text": "The vault rotates its owner key to it.", "t": r(at(5, 2)), "top": 916},
    ],
    end=r(at(7)),
)
slam(s_hand["cues"]["heading"], target="heading", scene_id="handover")
ev("sweep", s_hand["cues"]["play"] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.25)
ev("riser", r(at(6)), dur=1.25, gain=0.22)
ev("kick", r(at(6, 1)), gain=0.55)
ev("stamp", r(at(6, 1)) + 0.01, scale=1.4, pitch=1.0, gain=0.4)
for i, line in enumerate(s_hand["lines"]):
    slam(line["t"], gain=0.2, target=f"line{i}", scene_id="handover")

# =========================================================================
# 3 · THE VAULT — 17.5..27.5 s  (what actually transferred)
# =========================================================================
s_vault = scene(
    "vault", 7, 11, "chapter",
    word="The vault",
    rows=[
        {"left": "biz-7.reg.raizo07.testnet", "right": "2.00 NEAR"},
        {"left": "owner key", "right": "full access"},
        {"left": "operator key", "right": "record_sale, spend"},
    ],
    lines=[
        {"text": "Minting creates a real sub-account on NEAR.", "t": r(at(9, 1)), "top": 782},
        {"text": "Its own treasury. Its own keys. Its own rules.", "t": r(at(9, 3)), "top": 838},
    ],
    cues={
        "land": r(at(7)),
        "move": r(at(7) + 1.25 * BEAT),
        "sheet": r(at(7, 1.5)),
        "redact": r(at(9)),
        "lift": r(at(10, 2)),
    },
)
slam(s_vault["cues"]["land"], gain=0.5, w=0.6, target="word", scene_id="vault")
ev("kick", s_vault["cues"]["land"], gain=0.6)
ev("stamp", s_vault["cues"]["land"] + 0.01, scale=1.3, pitch=0.8, gain=0.4)
ev("sweep", s_vault["cues"]["sheet"] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.2)
for i in range(3):
    ev("slam", s_vault["cues"]["redact"] + i * EIGHTH, gain=0.3, pan=r(-0.3 + 0.1 * i), w=0.6)
for i in range(3):
    t = s_vault["cues"]["lift"] + i * EIGHTH
    ev("sweep", t - 0.12, dur=0.18, lo=900, hi=4200, up=True, gain=0.12, pan=r(-0.3 + 0.1 * i))
for i, line in enumerate(s_vault["lines"]):
    slam(line["t"], gain=0.2, target=f"line{i}", scene_id="vault")

# =========================================================================
# 4 · THE CHARTER — 27.5..35 s  (the rules the agent runs under)
# =========================================================================
s_charter = scene(
    "charter", 11, 14, "chapter",
    word="The charter",
    rows=[
        {"left": "per call", "right": "0.50 NEAR"},
        {"left": "per epoch", "right": "2.00 NEAR"},
        {"left": "allowlist", "right": "2 accounts"},
    ],
    lines=[
        {"text": "An agent with money, and a ceiling.", "t": r(at(12, 1)), "top": 782},
        {"text": "Not by prompt. By protocol.", "t": r(at(13, 1)), "top": 838},
    ],
    cues={
        "land": r(at(11)),
        "move": r(at(11) + 1.25 * BEAT),
        "sheet": r(at(11, 1.5)),
        "redact": r(at(12, 2)),
        "lift": r(at(13, 2)),
    },
)
slam(s_charter["cues"]["land"], gain=0.5, w=0.6, target="word", scene_id="charter")
ev("kick", s_charter["cues"]["land"], gain=0.6)
ev("stamp", s_charter["cues"]["land"] + 0.01, scale=1.3, pitch=0.8, gain=0.4)
ev("sweep", s_charter["cues"]["sheet"] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.2)
for i in range(3):
    ev("slam", s_charter["cues"]["redact"] + i * EIGHTH, gain=0.3, pan=r(-0.3 + 0.1 * i), w=0.6)
for i in range(3):
    t = s_charter["cues"]["lift"] + i * EIGHTH
    ev("sweep", t - 0.12, dur=0.18, lo=900, hi=4200, up=True, gain=0.12, pan=r(-0.3 + 0.1 * i))
for i, line in enumerate(s_charter["lines"]):
    slam(line["t"], gain=0.2, target=f"line{i}", scene_id="charter")

# =========================================================================
# 5 · THE REFUSAL — 35..45 s  (recorded product moment)
# =========================================================================
s_ref = scene(
    "refusal", 14, 18, "clip",
    heading="The refusal",
    dir="../clips/a",
    count=150,
    frame_from=10,
    fps=30,
    frameW=1920,
    sheet={"x": 830, "y": 250, "w": 980, "h": 560},
    cues={
        "heading": r(at(14)),
        "play": r(at(14, 1)),
        "punch": r(at(16, 1)),
        "camera": [
            {"t": r(at(14, 1)), "x": 60, "y": 100, "w": 1820, "dur": 0.6},
            {"t": r(at(15, 2)), "x": 980, "y": 480, "w": 860, "dur": 0.8},
            {"t": r(at(16, 1)), "x": 1150, "y": 0, "w": 770, "dur": 0.7},
        ],
    },
    lines=[
        {"text": "The cap is a number on chain.", "t": r(at(15, 2)), "top": 860},
        {"text": "The agent tries 1.5x it. E20.", "t": r(at(16, 3)), "top": 916},
    ],
    end=r(at(18)),
)
slam(s_ref["cues"]["heading"], target="heading", scene_id="refusal")
ev("sweep", s_ref["cues"]["play"] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.25)
ev("stamp", s_ref["cues"]["punch"], scale=0.9, pitch=0.55, gain=0.5)
ev("kick", s_ref["cues"]["punch"] + 0.01, gain=0.5)
for i, line in enumerate(s_ref["lines"]):
    slam(line["t"], gain=0.2, target=f"line{i}", scene_id="refusal")

# =========================================================================
# 6 · THE SWITCH — 45..55 s  (halt, then the key is gone)
# =========================================================================
CMD = "near call biz-7 halt --accountId raizo07.testnet"
s_halt = scene(
    "halt", 18, 22, "terminal",
    heading="The switch",
    window_title="handover — near",
    cues={
        "heading": r(at(18)),
        "window": r(at(18, 1)),
        "outputs": [r(at(19, 2) + i * SIXTEENTH * 2) for i in range(5)],
    },
    command=CMD,
    outputs=[
        "receipt   DeleteKey(ed25519:9E8s…)",
        "state     halted: true",
        "replay    E23 operator halted",
        "next tx   Access key does not exist",
        "ok        the key is gone",
    ],
    ok_index=4,
    lines=[{"text": "Not a flag. The key is gone.", "t": r(at(21, 2)), "top": 940}],
)
slam(s_halt["cues"]["heading"], target="heading", scene_id="halt")
ev("sweep", s_halt["cues"]["window"] - 0.12, dur=0.32, lo=400, hi=2600, up=True, gain=0.16, pan=0.2)
typed(r(at(18, 2)), CMD, BEAT / 16, level=1.0, pan=0.15, gain=0.10, scene_id="halt")
for i, t in enumerate(s_halt["cues"]["outputs"]):
    ev("bloop", t, f0=1500, f1=1200, dur=0.03, gain=0.10, pan=0.15)
    ev("typekey", t + 0.02, level=0.5, gain=0.08, pan=0.15)
ev("bell", r(at(21)), midi=88, decay=0.5, ratio=2.0, index=0.6, gain=0.18, pan=0.2)
slam(s_halt["lines"][0]["t"], gain=0.2, target="line0", scene_id="halt")

# =========================================================================
# 7 · THE PROOF — 55..62.5 s  (32 tests, counted)
# =========================================================================
s_proof = scene(
    "proof", 22, 25, "counter",
    heading="32 tests",
    label="tests",
    cues={
        "heading": r(at(22)),
        "count_start": r(at(22, 2)),
        "count_end": r(at(24)),
    },
    count={"from": 0, "to": 32, "rows": 22},
    lines=[
        {"text": "Every rule the contract enforces, asserted in Rust.", "t": r(at(24, 1)), "top": 770},
        {"text": "Four of them deploy real wasm and call it.", "t": r(at(24, 3)), "top": 828},
    ],
)
slam(s_proof["cues"]["heading"], target="heading", scene_id="proof")
_start, _end = s_proof["cues"]["count_start"], s_proof["cues"]["count_end"]
for x in range(28):
    ev("typekey", _start + (_end - _start) * (1 - (1 - x / 27) ** 1.8),
       level=r(0.5 + 0.5 * RND()), gain=0.07, pan=r(-0.4 + 0.03 * x))
for i, line in enumerate(s_proof["lines"]):
    slam(line["t"], gain=0.18, target=f"line{i}", scene_id="proof")

# =========================================================================
# 8 · NAME — 62.5..72.5 s
# =========================================================================
s_name = scene(
    "name", 25, 29, "name",
    word="FREEHOLD",
    sub="A business is a NEAR account",
    cues={
        "riser": r(at(25)),
        "bars": [r(at(25, 1) + i * SIXTEENTH) for i in range(3)],
        "reveal": r(at(26)),
        "sub": r(at(27, 2)),
    },
)
ev("riser", s_name["cues"]["riser"], dur=2 * BEAT)
for i, t in enumerate(s_name["cues"]["bars"]):
    slam(t, gain=0.4, w=0.4, pan=r(-0.3 + 0.3 * i), target=f"bar{i}", scene_id="name")
ev("kick", s_name["cues"]["reveal"], gain=0.5)
for i, midi in enumerate([62, 66, 69, 73, 78]):
    ev("bell", s_name["cues"]["reveal"] + i * 0.004, midi=midi, decay=1.0, ratio=1.0, index=0.8,
       gain=0.16, pan=r(-0.3 + 0.15 * i))
slam(s_name["cues"]["sub"], gain=0.2, target="sub", scene_id="name")

# =========================================================================
# 9 · END — 72.5..85 s
# =========================================================================
s_end = scene(
    "end", 29, 34, "title",
    eyebrow="FREEHOLD · NEAR HACKATHON 2026",
    lines=[
        {"text": "Buy a going concern,", "cls": "display", "size": 118, "t": r(at(29)), "top": 300},
        {"text": "not a keyring.", "cls": "display", "size": 118, "t": r(at(30)), "top": 410},
    ],
    sub={"text": "raizo07.github.io/freehold  ·  github.com/raizo07/freehold", "t": r(at(31)), "top": 640, "mono": True},
    mascot={"enter": r(at(31, 2)), "x": 1500, "y": 700, "w": 250, "h": 108},
    out=83.2,
)
slam(s_end["lines"][0]["t"], target="line0", scene_id="end")
slam(s_end["lines"][1]["t"], target="line1", scene_id="end")
slam(s_end["sub"]["t"], gain=0.16, target="sub", scene_id="end")
ev("sweep", s_end["mascot"]["enter"] - 0.15, dur=0.4, lo=200, hi=1400, up=True, gain=0.16, pan=0.2)
ev("redact", s_end["out"], gain=0.2)

# --- wipes at every scene cut ---------------------------------------------
for a, b in zip(SCENES, SCENES[1:]):
    assert a["end"] == b["start"], (a["id"], b["id"])
    wipe(a["end"])

# --- music grid ------------------------------------------------------------
PROG_A = ["Dmaj9", "Bm9", "Gmaj9", "A7sus4"]
PROG_B = ["Em9", "F#m7", "Gmaj7", "A7"]
QUIET = set(range(25, 29))
MUSIC = []
for b in range(BARS):
    if b < 14:
        chord = PROG_A[b % 4]
    elif b < 22:
        chord = PROG_B[b % 4]
    else:
        chord = PROG_A[b % 4]
    MUSIC.append({"bar": b, "chord": chord, "quiet": b in QUIET})

# --- assemble --------------------------------------------------------------
EVENTS.sort(key=lambda e: (e["t"], e["kind"]))
timeline = {
    "meta": {
        "bpm": BPM, "beat": BEAT, "bar": BAR, "bars": BARS,
        "fps": FPS, "width": W, "height": H, "duration": DURATION,
        "project": "FREEHOLD",
        "seed": 2610,
    },
    "scenes": SCENES,
    "events": EVENTS,
    "music": {"bars": MUSIC},
}

out = pathlib.Path(__file__).parent / "timeline.json"
out.write_text(json.dumps(timeline, indent=1))

js = pathlib.Path(__file__).parent / "src" / "timeline.js"
js.write_text("window.__TIMELINE__ = " + json.dumps(timeline, separators=(",", ":")) + ";\n")
print(f"scenes {len(SCENES)} · events {len(EVENTS)} · {DURATION:.0f}s · {out.name} "
      f"{out.stat().st_size // 1024} KB")
for kind in sorted({e["kind"] for e in EVENTS}):
    print(f"  {kind:<9} {sum(1 for e in EVENTS if e['kind'] == kind)}")
