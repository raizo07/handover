#!/usr/bin/env python3
"""voice.py — narration with the only TTS available offline (macOS `say`).

Kokoro is not installed and there is no model cache for faster-whisper, so the
voice is `say` (Samantha, en_US). Each caption line is synthesised on its own,
measured, then placed at its start time on a 48 kHz stereo bed. Word timings in
timeline.json are recomputed from the *measured* duration of each line, so the
captions follow the audio rather than an estimate of it.

Writes audio/voice.wav and rewrites timeline.json / src/timeline.js captions.
"""
import json
import pathlib
import subprocess
import wave
import array

ROOT = pathlib.Path(__file__).parent
VOICE = "Samantha"
RATE = 168          # words per minute; slower than default because it read fast
SR = 48000
TL = json.loads((ROOT / "timeline.json").read_text())
DUR = TL["meta"]["duration"]

tmp = ROOT / "audio" / "vo"
tmp.mkdir(parents=True, exist_ok=True)

# 1 · synthesise each line
lines = []
for i, c in enumerate(TL["captions"]):
    aiff = tmp / f"l{i:02d}.aiff"
    subprocess.run(["say", "-v", VOICE, "-r", str(RATE), "-o", str(aiff), c["text"]], check=True)
    wav = tmp / f"l{i:02d}.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(aiff),
                    "-ar", str(SR), "-ac", "2", str(wav)], check=True)
    with wave.open(str(wav)) as w:
        lines.append({"i": i, "wav": wav, "dur": w.getnframes() / w.getframerate()})
    print(f"  {i:02d}  {lines[-1]['dur']:5.2f}s  {c['text'][:60]}")

# 2 · lay them out on one track, and tighten the captions to the measured length
total = int(DUR * SR) + SR
mix = array.array("h", bytes(total * 2 * 2))
for ln in lines:
    c = TL["captions"][ln["i"]]
    start = int(c["t"] * SR)
    with wave.open(str(ln["wav"])) as w:
        frames = array.array("h", w.readframes(w.getnframes()))
    n = len(frames) // 2
    for k in range(n):
        idx = start + k
        if idx * 2 + 1 >= len(mix):
            break
        mix[idx * 2] += frames[k * 2]
        mix[idx * 2 + 1] += frames[k * 2 + 1]

    # word times from the measured duration, weighted by word length
    words = c["words"]
    weights = [max(2, len(w["w"])) for w in words]
    tot = sum(weights)
    t = c["t"]
    for w, wt in zip(words, weights):
        w["t"] = round(t, 4)
        t += ln["dur"] * wt / tot
        w["e"] = round(t, 4)
    c["end"] = round(c["t"] + ln["dur"], 4)

with wave.open(str(ROOT / "audio" / "voice.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(mix.tobytes())

(ROOT / "timeline.json").write_text(json.dumps(TL, indent=1))
(ROOT / "src" / "timeline.js").write_text(
    "window.__TIMELINE__ = " + json.dumps(TL, separators=(",", ":")) + ";\n")
print(f"voice.wav  {len(lines)} lines")
