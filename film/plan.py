#!/usr/bin/env python3
"""plan.py — one clock for picture and sound.

120 BPM, 66 bars, 132 s, 1920x1080 at 60 fps. Writes timeline.json (scenes,
captions with per-word times, sound events, music grid) and src/timeline.js.

Every number on screen is either read from the live product or measured from
the deployed contracts; data/sources.json records where each one came from.
"""
import json
import pathlib

BPM = 120
BEAT = 60.0 / BPM        # 0.5
BAR = 4 * BEAT           # 2.0
FPS = 60
W, H = 1920, 1080
BARS = 66
DURATION = BARS * BAR    # 132.0

ROOT = pathlib.Path(__file__).parent
SCENES, CAPTIONS, EVENTS = [], [], []


def at(bar, beat=0.0):
    return bar * BAR + beat * BEAT


def r(x):
    return round(x, 6)


def scene(sid, b0, b1, kind, **data):
    s = {"id": sid, "start": r(at(b0)), "end": r(at(b1)), "kind": kind, **data}
    SCENES.append(s)
    return s


def ev(kind, t, **kw):
    EVENTS.append({"kind": kind, "t": r(t), **kw})


def cap(t0, t1, text, keyword):
    """One caption line. `keyword` is the word that carries the accent, matched
    ignoring punctuation so the script reads like prose."""
    words = text.split()
    bare = [w.strip(".,:;!?") for w in words]
    hi = bare.index(keyword) if keyword in bare else 0
    span = (t1 - t0) / max(1, len(words))
    CAPTIONS.append({
        "t": r(t0),
        "end": r(t1),
        "text": text,
        "hi": hi,
        "words": [{"w": w, "t": r(t0 + i * span), "e": r(t0 + (i + 1) * span)} for i, w in enumerate(words)],
    })


def whoosh(t):
    ev("sweep", t - 0.28, dur=0.5, lo=380, hi=3200, up=True, gain=0.20)


def hit(t, gain=0.5):
    ev("slam", t, gain=gain, w=0.6)
    ev("kick", t + 0.01, gain=0.35)


# =========================================================================
# 1 · HOOK — 0..10 s   chaos around the mark, then an iris
# =========================================================================
scene("hook", 0, 5, "chaos",
      mark_from=1.2,
      cards=[
          {"label": "NFT", "sub": "a picture", "x": 250, "y": 210, "rot": -7},
          {"label": "0 NEAR", "sub": "treasury", "x": 1430, "y": 250, "rot": 6},
          {"label": "key", "sub": "held by one person", "x": 300, "y": 720, "rot": 4},
          {"label": "operator", "sub": "not in the sale", "x": 1380, "y": 700, "rot": -5},
          {"label": "customers", "sub": "left behind", "x": 760, "y": 180, "rot": 3},
          {"label": "suppliers", "sub": "re-signed by hand", "x": 700, "y": 760, "rot": -3},
      ],
      badges=["no treasury", "no operator", "no access", "just a token"])
for i, t in enumerate([0.3, 0.7, 1.1, 1.5, 1.9, 2.3]):
    ev("bell", t, freq=880, decay=0.2, ratio=2.0, index=0.5, gain=0.10, pan=r(-0.5 + 0.2 * i))
hit(1.2, 0.45)
whoosh(10.0)

# =========================================================================
# 2 · FIRST CONTACT — 10..30 s   the live marketplace
# =========================================================================
scene("contact", 5, 15, "clip",
      heading="One token, one account",
      clip="market", frames=200, from_frame=1, play=at(5, 1),
      sheet={"x": 96, "y": 214, "w": 1728, "h": 620},
      camera=[{"t": at(5, 1), "x": 120, "y": 60, "w": 2320, "dur": 1.0},
              {"t": at(7, 0), "x": 180, "y": 400, "w": 1500, "dur": 1.4},
              {"t": at(11, 0), "x": 160, "y": 430, "w": 1700, "dur": 1.2}],
      punch=[at(9, 2)],
      card={"text": "The token is the share.", "t": at(6, 2), "sub": "its treasury, its keys, its operator"},
      end=at(15))
whoosh(10.0)
hit(12.4)
ev("pop" if False else "bell", at(6, 2), freq=1180, decay=0.22, ratio=1.0, index=0.3, gain=0.12)
whoosh(30.0)

# =========================================================================
# 3 · THE CORE ACTION — 30..50 s   the charter refuses an overspend
# =========================================================================
scene("action", 15, 25, "clip",
      heading="The cap is a number on chain",
      clip="charter", frames=222, from_frame=1, play=at(15, 1),
      sheet={"x": 96, "y": 214, "w": 1728, "h": 620},
      camera=[{"t": at(15, 1), "x": 160, "y": 120, "w": 2200, "dur": 0.8},
              {"t": at(16, 2), "x": 980, "y": 420, "w": 1300, "dur": 1.0},
              {"t": at(19, 0), "x": 1150, "y": 0, "w": 1400, "dur": 0.8}],
      punch=[at(18, 2)],
      card={"text": "0.50 NEAR", "t": at(16, 2), "sub": "per call, enforced by the vault", "x": 1230, "y": 96},
      end=at(25))
whoosh(30.0)
hit(38.8, 0.55)
ev("stamp", at(18, 2), scale=1.4, pitch=0.85, gain=0.5)
whoosh(50.0)

# =========================================================================
# 4 · THE MECHANISM — 50..68 s   two beats, a key rotation
# =========================================================================
scene("mechanism", 25, 34, "clip",
      heading="Selling rotates the owner key",
      clip="handover", frames=313, from_frame=96, play=at(25, 1),
      sheet={"x": 96, "y": 214, "w": 1728, "h": 620},
      camera=[{"t": at(25, 1), "x": 180, "y": 300, "w": 2000, "dur": 0.9},
              {"t": at(27, 2), "x": 240, "y": 560, "w": 1400, "dur": 1.2},
              {"t": at(30, 0), "x": 240, "y": 540, "w": 1320, "dur": 1.0}],
      punch=[at(29, 2)],
      card={"text": "pending → applied", "t": at(31, 0), "sub": "two confirmed beats"},
      end=at(34))
whoosh(50.0)
hit(56.0)
ev("riser", at(29, 0), dur=1.0, gain=0.18)
whoosh(68.0)

# =========================================================================
# 5 · THE PROOF — 68..96 s   the receipt, the tests, the live registry
# =========================================================================
scene("proof", 34, 48, "proof",
      heading="The registry settles it",
      receipt=[
          ['"standard": "freehold"', "ok"],
          ['"event": "business_minted"', ""],
          ['"token_id": "biz-3"', ""],
          ['"vault": "biz-3.freehold…"', ""],
          ['"result": "on chain"', "ok"],
      ],
      stamp={"text": "Verified", "ok": True, "t": at(40, 0)},
      stats=[
          {"n": "32", "l": "tests", "t": at(42, 0)},
          {"n": "4", "l": "deploy real wasm", "t": at(43, 0)},
          {"n": "3", "l": "businesses live", "t": at(44, 0)},
      ],
      end=at(48))
whoosh(68.0)
for i in range(5):
    ev("typekey", at(35, 0) + i * 0.18, level=0.7, gain=0.09, pan=r(-0.2 + 0.1 * i))
ev("stamp", at(40, 0), scale=1.6, pitch=1.0, gain=0.55)
ev("kick", at(40, 0) + 0.01, gain=0.45)
for i in range(3):
    ev("bell", at(42 + i, 0), freq=1320, decay=0.25, ratio=2.0, index=0.4, gain=0.12, pan=r(-0.3 + 0.3 * i))
whoosh(96.0)

# =========================================================================
# 6 · THE SECOND BUSINESS — 96..118 s   cloth, not coffee
# =========================================================================
scene("second", 48, 59, "tiles",
      heading="A second business, same charter",
      clip="live", frames=220, from_frame=1, play=at(48, 1),
      sheet={"x": 96, "y": 200, "w": 1100, "h": 560},
      camera=[{"t": at(48, 1), "x": 120, "y": 120, "w": 2260, "dur": 1.0},
              {"t": at(50, 0), "x": 200, "y": 140, "w": 2100, "dur": 1.2}],
      tiles=[
          {"n": "3", "l": "businesses on testnet", "t": at(49, 0), "x": 1240, "y": 210},
          {"n": "1.50", "l": "NEAR per call · biz-9", "t": at(50, 0), "x": 1240, "y": 420},
          {"n": "32", "l": "contract tests", "t": at(51, 0), "x": 1240, "y": 630},
      ],
      end=at(59))
whoosh(96.0)
for i in range(3):
    ev("bell", at(52 + 2 * i, 0), freq=1180, decay=0.3, ratio=1.0, index=0.35, gain=0.12, pan=0.3)
whoosh(118.0)

# =========================================================================
# 7 · CLOSE — 118..132 s   the globe, then the card
# =========================================================================
scene("close", 59, 66, "close",
      heading="Live now",
      globe={"t": at(59, 1)},
      card={"t": at(61, 0), "url": "raizo07.github.io/freehold", "repo": "github.com/raizo07/freehold"},
      end=at(66))
whoosh(118.0)
ev("riser", at(59, 0), dur=1.0, gain=0.2)
hit(122.0, 0.5)
for i, midi in enumerate([62, 66, 69, 73, 78]):
    ev("bell", 122.0 + i * 0.004, midi=midi, decay=1.0, ratio=1.0, index=0.8, gain=0.14, pan=r(-0.3 + 0.15 * i))

# --- narration: 16 lines, about five seconds each so an average reader keeps up ---
NARRATION = [
    (1.0, 5.0, 'Onchain, a business sold is a picture and a name.'),
    (7.0, 5.0, 'No till, no keys, no operator — nothing that came.'),
    (12.5, 5.5, 'FREEHOLD makes the business an account you hold.'),
    (18.5, 5.5, 'One token, one sub-account — its treasury, its gold.'),
    (25.0, 5.0, 'Its keys, its rules, its money, in one place.'),
    (31.5, 5.0, 'The cap is a number written on chain.'),
    (37.5, 5.5, 'The agent tries more — refused, and nothing moves.'),
    (51.5, 5.0, 'The sale is a rotation, in two beats.'),
    (57.5, 5.5, "Pending, then applied — the seller's key retreats."),
    (69.5, 5.0, 'The proof is a receipt, and the tests are in Rust.'),
    (75.5, 5.0, 'Thirty-two pass — and the chain keeps the trust.'),
    (81.5, 5.0, 'Three businesses live, and the rules are the same.'),
    (97.5, 5.0, 'A second business sells cloth, by the same code.'),
    (103.5, 5.0, 'Its own cap, its own treasury — on the same road.'),
    (119.5, 5.0, 'Live on testnet today, and the tokens are free.'),
    (125.5, 5.5, 'Come and buy a business that keeps working — you will see.'),
]

for _t, _d, _text in NARRATION:
    cap(_t, _t + _d, _text, _text.split()[-1].strip('.,!?—'))

# wipes land on every cut
for a, b in zip(SCENES, SCENES[1:]):
    assert a["end"] == b["start"], (a["id"], b["id"])

PROG = ["Dmaj9", "Bm9", "Gmaj9", "A7sus4"]
MUSIC = [{"bar": b, "chord": PROG[b % 4], "quiet": b in range(59, 66)} for b in range(BARS)]

EVENTS.sort(key=lambda e: (e["t"], e["kind"]))
timeline = {
    "meta": {
        "bpm": BPM, "beat": BEAT, "bar": BAR, "bars": BARS, "fps": FPS,
        "width": W, "height": H, "duration": DURATION, "project": "FREEHOLD",
        "format": "1920x1080 · 60",
        "truth": "NEAR testnet · free test tokens · three businesses live",
        "seed": 2610,
    },
    "scenes": SCENES,
    "captions": CAPTIONS,
    "events": EVENTS,
    "music": {"bars": MUSIC},
}

(ROOT / "timeline.json").write_text(json.dumps(timeline, indent=1))
(ROOT / "src" / "timeline.js").write_text(
    "window.__TIMELINE__ = " + json.dumps(timeline, separators=(",", ":")) + ";\n")

print(f"scenes {len(SCENES)} · captions {len(CAPTIONS)} · events {len(EVENTS)} · {DURATION:.0f}s")
