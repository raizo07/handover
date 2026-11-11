#!/usr/bin/env python3
"""plan.py — the single source of truth for the HANDOVER film.

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
BARS = 48
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
# 1 · OPEN — 0..10 s  (the problem)
# =========================================================================
s_open = scene(
    "open", 0, 4, "title",
    eyebrow="HANDOVER · NEAR HACKATHON 2026 · TESTNET",
    eyebrow_t=-0.18,
    lines=[
        {"text": "Sell a business onchain,", "cls": "display", "size": 132, "t": -0.18, "top": 250},
        {"text": "the buyer gets a picture.", "cls": "display", "size": 132, "t": r(at(0, 2)), "top": 380},
        {"text": "Not the business.", "cls": "display", "size": 132, "t": r(at(1)), "top": 510},
    ],
    sub={"text": "So we made the business an account.", "t": r(at(2)), "top": 726},
    mascot={"enter": r(at(2, 2)), "x": 1530, "y": 730, "w": 250, "h": 108},
)
slam(at(0), target="eyebrow", scene_id="open")
for i, line in enumerate(s_open["lines"]):
    slam(line["t"], target=f"line{i}", scene_id="open")
    slam(line["t"], gain=0.10, pan=0.1, w=0.3)
ev("sweep", at(2, 2) - 0.15, dur=0.4, lo=200, hi=1400, up=True, gain=0.16, pan=0.2)
ev("bloop", at(2, 2) + 1.2, f0=800, f1=1300, dur=0.05, gain=0.12, pan=0.2)
ev("bloop", at(2, 2) + 1.2 + EIGHTH, f0=800, f1=1300, dur=0.05, gain=0.10, pan=0.25)
ev("bloop", at(3, 1), f0=420, f1=760, dur=0.09, gain=0.14, pan=0.2)
slam(s_open["sub"]["t"], gain=0.14, target="sub", scene_id="open")

# =========================================================================
# 2 · THE VAULT — 10..20 s  (chapter word, rows redacted then lifted)
# =========================================================================
s_vault = scene(
    "vault", 4, 8, "chapter",
    word="The vault",
    rows=[
        {"left": "biz-7.reg.raizo07.testnet", "right": "2.00 NEAR"},
        {"left": "owner key", "right": "ed25519:hpbc…YhC7"},
        {"left": "operator key", "right": "record_sale, spend"},
    ],
    lines=[
        {"text": "Minting a business creates a real sub-account.", "t": r(at(6, 1)), "top": 782},
        {"text": "Its own treasury. Its own keys. Its own rules.", "t": r(at(6, 3)), "top": 838},
    ],
    cues={
        "land": r(at(4)),
        "move": r(at(4) + 1.25 * BEAT),
        "sheet": r(at(4, 1.5)),
        "redact": r(at(6)),
        "lift": r(at(7, 2)),
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
# 3 · THE PROOF — 20..30 s  (counter + dots)
# =========================================================================
s_count = scene(
    "proof", 8, 12, "counter",
    heading="32 tests",
    label="tests",
    cues={
        "heading": r(at(8)),
        "count_start": r(at(8, 2)),
        "count_end": r(at(10)),
    },
    count={"from": 0, "to": 32, "rows": 22},
    lines=[
        {"text": "Every rule the contract enforces, asserted in Rust.", "t": r(at(10, 1)), "top": 770},
        {"text": "Four of them deploy real wasm and call it.", "t": r(at(10, 3)), "top": 828},
    ],
)
slam(s_count["cues"]["heading"], target="heading", scene_id="proof")
slam(s_count["cues"]["count_start"], gain=0.12, w=0.35)
_start, _end = s_count["cues"]["count_start"], s_count["cues"]["count_end"]
for x in range(28):
    ev("typekey", _start + (_end - _start) * (1 - (1 - x / 27) ** 1.8),
       level=r(0.5 + 0.5 * RND()), gain=0.07, pan=r(-0.4 + 0.03 * x))
for i, line in enumerate(s_count["lines"]):
    slam(line["t"], gain=0.18, target=f"line{i}", scene_id="proof")

# =========================================================================
# 4 · LIVE — 30..40 s  (real screen, camera, green stamp)
# =========================================================================
s_live = scene(
    "live", 12, 16, "screen",
    heading="Live on testnet",
    cues={
        "heading": r(at(12)),
        "sheet": r(at(12, 1.5)),
        "stamp": r(at(14, 2)),
    },
    image="../assets/art/screen-live.png",
    sheet={"x": 830, "y": 236, "w": 980},
    boxes=[
        {"x": 260, "y": 200, "w": 2400},
        {"x": 1680, "y": 1180, "w": 1200},
    ],
    stamp={"text": "Verified", "ok": True, "rot": -7},
    lines=[{"text": "Two businesses minted. One registry.", "t": r(at(15)), "top": 900}],
    end=r(at(16)),
)
slam(s_live["cues"]["heading"], target="heading", scene_id="live")
ev("sweep", s_live["cues"]["sheet"] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.25)
ev("sweep", s_live["cues"]["sheet"] + 0.25, dur=0.3, lo=300, hi=1800, up=True, gain=0.10)
ev("stamp", s_live["cues"]["stamp"], scale=1.6, pitch=1.0, gain=0.55)
ev("kick", s_live["cues"]["stamp"] + 0.01, gain=0.45)
slam(s_live["lines"][0]["t"], gain=0.2, target="line0", scene_id="live")

# =========================================================================
# 5 · THE CHARTER — 40..50 s  (chapter word again, the rules)
# =========================================================================
s_charter = scene(
    "charter", 16, 20, "chapter",
    word="The charter",
    rows=[
        {"left": "per call", "right": "0.50 NEAR"},
        {"left": "per epoch", "right": "2.00 NEAR"},
        {"left": "allowlist", "right": "2 accounts"},
    ],
    lines=[
        {"text": "An agent with money, and a ceiling.", "t": r(at(18, 1)), "top": 782},
        {"text": "Not by prompt. By protocol.", "t": r(at(18, 3)), "top": 838},
    ],
    cues={
        "land": r(at(16)),
        "move": r(at(16) + 1.25 * BEAT),
        "sheet": r(at(16, 1.5)),
        "redact": r(at(18)),
        "lift": r(at(19, 2)),
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
# 6 · THE REFUSAL — 50..60 s  (key turns, red stamp)
# =========================================================================
s_no = scene(
    "limit", 20, 24, "refusal",
    heading="Not this one.",
    key={"label": "E21 · epoch cap"},
    stamp={"text": "Rejected", "ok": False},
    lines=[{"text": "The agent tried. The vault said no.", "t": r(at(23)), "top": 900}],
    cues={
        "heading": r(at(20)),
        "key": r(at(21)),
        "stamp": r(at(22)),
        "jiggle": r(at(22)),
    },
)
slam(s_no["cues"]["heading"], target="heading", scene_id="limit")
ev("sweep", s_no["cues"]["key"] - 0.1, dur=0.3, lo=600, hi=2000, up=True, gain=0.14)
ev("bell", s_no["cues"]["key"] + 0.15, freq=220, decay=0.5, ratio=4.1, index=0.5, gain=0.12)
ev("stamp", s_no["cues"]["stamp"], scale=0.7, pitch=0.6, gain=0.4)
ev("stamp", s_no["cues"]["stamp"] + SIXTEENTH, scale=0.7, pitch=0.6, gain=0.32)
slam(s_no["lines"][0]["t"], gain=0.18, target="line0", scene_id="limit")

# =========================================================================
# 7 · THE HANDOVER — 60..70 s  (receipt printer, the two beats)
# =========================================================================
s_rec = scene(
    "transform", 24, 28, "receipt",
    heading="The handover",
    cues={
        "heading": r(at(24)),
        "slot": r(at(24, 1.5)),
        "print": [r(at(25) + i * EIGHTH) for i in range(5)],
        "tear": r(at(27, 2)),
    },
    receipt={
        "width": 720,
        "pitch": 44,
        "lines": [
            {"left": "rotation_pending", "right": "token → buyer"},
            {"left": "rotation_applied", "right": "key rotated"},
            {"left": "seller key", "right": "deleted"},
            {"left": "operator", "right": "still trading"},
            {"left": "epoch", "right": "1 → 2"},
        ],
        "foot": "two confirmed beats",
    },
    lines=[{"text": "Separate receipts. A callback settles them.", "t": r(at(28)), "top": 940}],
)
slam(s_rec["cues"]["heading"], target="heading", scene_id="transform")
ev("sweep", s_rec["cues"]["slot"] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=0.2)
for i, t in enumerate(s_rec["cues"]["print"]):
    ev("printer", t, dur=0.12 if i % 2 == 0 else 0.22, gain=r(0.13 + 0.03 * (i % 2)), pan=0.1)
ev("tear", s_rec["cues"]["tear"], gain=0.16)
slam(s_rec["lines"][0]["t"], gain=0.2, target="line0", scene_id="transform")

# =========================================================================
# 8 · THE SWITCH — 70..80 s  (terminal: halt, then E23)
# =========================================================================
CMD = "near call biz-7 halt --accountId raizo07.testnet"
s_halt = scene(
    "halt", 28, 32, "terminal",
    heading="The switch",
    cues={
        "heading": r(at(28)),
        "window": r(at(28, 1)),
        "outputs": [r(at(29, 2) + i * SIXTEENTH * 2) for i in range(5)],
    },
    command=CMD,
    window_title="handover — near",
    outputs=[
        "receipt   DeleteKey(ed25519:9E8s…)",
        "state     halted: true",
        "replay    E23 operator halted",
        "next tx   Access key does not exist",
        "ok        the key is gone",
    ],
    ok_index=4,
    lines=[{"text": "Not a flag. The key is gone.", "t": r(at(31, 2)), "top": 940}],
)
slam(s_halt["cues"]["heading"], target="heading", scene_id="halt")
ev("sweep", s_halt["cues"]["window"] - 0.12, dur=0.32, lo=400, hi=2600, up=True, gain=0.16, pan=0.2)
typed(r(at(28, 2)), CMD, BEAT / 16, level=1.0, pan=0.15, gain=0.10, scene_id="halt")
for i, t in enumerate(s_halt["cues"]["outputs"]):
    ev("bloop", t, f0=1500, f1=1200, dur=0.03, gain=0.10, pan=0.15)
    ev("typekey", t + 0.02, level=0.5, gain=0.08, pan=0.15)
ev("bell", r(at(31)), midi=88, decay=0.5, ratio=2.0, index=0.6, gain=0.18, pan=0.2)
slam(s_halt["lines"][0]["t"], gain=0.2, target="line0", scene_id="halt")

# =========================================================================
# 9 · SAME BUSINESS — 80..90 s  (two keys, two outcomes)
# =========================================================================
s_cmp = scene(
    "keys", 32, 36, "compare",
    heading="Same business",
    grade_prefix="",
    sheets=[
        {"label": "seller", "score": "GONE", "grade": "key deleted", "side": "left",
         "stamp": {"text": "Revoked", "ok": False}},
        {"label": "buyer", "score": "LIVE", "grade": "key rotated", "side": "right",
         "stamp": {"text": "Verified", "ok": True}},
    ],
    lines=[{"text": "Ownership is a key rotation, not a row.", "t": r(at(35)), "top": 980}],
    cues={
        "heading": r(at(32)),
        "sheetA": r(at(32, 1.5)),
        "sheetB": r(at(32, 2)),
        "stampA": r(at(33, 2)),
        "stampB": r(at(34)),
    },
)
slam(s_cmp["cues"]["heading"], target="heading", scene_id="keys")
for key, pan in (("sheetA", -0.2), ("sheetB", 0.2)):
    ev("sweep", s_cmp["cues"][key] - 0.05, dur=0.25, lo=500, hi=3000, up=False, gain=0.16, pan=pan)
for key, pitch in (("stampA", 0.85), ("stampB", 1.0)):
    ev("stamp", s_cmp["cues"][key], scale=1.6, pitch=pitch, gain=0.55, pan=-0.2 if key == "stampA" else 0.2)
    ev("kick", s_cmp["cues"][key] + 0.01, gain=0.45)
slam(s_cmp["lines"][0]["t"], gain=0.2, target="line0", scene_id="keys")

# =========================================================================
# 10 · ON A PHONE — 90..100 s
# =========================================================================
s_phone = scene(
    "phone", 36, 40, "phone",
    heading="It runs anywhere",
    image="../assets/art/screen-phone.png",
    lines=[{"text": "raizo07.github.io/handover", "t": r(at(39, 2)), "top": 880, "mono": True}],
    cues={
        "heading": r(at(36)),
        "phone": r(at(36, 1)),
        "scroll": r(at(37)),
        "scan": [],
        "tick": r(at(38, 2)),
        "handover": r(at(39, 2)),
    },
)
slam(s_phone["cues"]["heading"], target="heading", scene_id="phone")
ev("sweep", s_phone["cues"]["phone"] - 0.12, dur=0.32, lo=400, hi=2600, up=True, gain=0.16, pan=0.2)
ev("bell", s_phone["cues"]["tick"], midi=81, decay=0.4, ratio=2.0, index=0.5, gain=0.16)
ev("bell", s_phone["cues"]["tick"] + EIGHTH, midi=86, decay=0.4, ratio=2.0, index=0.5, gain=0.14)
ev("bloop", s_phone["cues"]["handover"], f0=900, f1=1400, dur=0.05, gain=0.14, pan=-0.2)

# =========================================================================
# 11 · NAME — 100..110 s
# =========================================================================
s_name = scene(
    "name", 40, 44, "name",
    word="HANDOVER",
    sub="A business is a NEAR account",
    cues={
        "riser": r(at(40)),
        "bars": [r(at(40, 1) + i * SIXTEENTH) for i in range(3)],
        "reveal": r(at(41)),
        "sub": r(at(42, 2)),
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
# 12 · END — 110..120 s
# =========================================================================
s_end = scene(
    "end", 44, 48, "title",
    eyebrow="HANDOVER · NEAR HACKATHON 2026",
    lines=[
        {"text": "Buy a going concern,", "cls": "display", "size": 118, "t": r(at(44)), "top": 300},
        {"text": "not a keyring.", "cls": "display", "size": 118, "t": r(at(45)), "top": 410},
    ],
    sub={"text": "raizo07.github.io/handover", "t": r(at(46)), "top": 640, "mono": True},
    mascot={"enter": r(at(46, 2)), "x": 1500, "y": 700, "w": 250, "h": 108},
    out=118.2,
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
QUIET = set(range(32, 36)) | set(range(40, 44))
MUSIC = []
for b in range(BARS):
    if b < 16:
        chord = PROG_A[b % 4]
    elif b < 32:
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
        "project": "HANDOVER",
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
