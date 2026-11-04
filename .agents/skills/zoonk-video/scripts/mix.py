"""Mixes narration, a music bed and UI sounds into a -14 LUFS / -1.5 dBTP soundtrack.

usage: python3 scripts/mix.py <film> <cut> <lang> <music> <out.wav>
Lines and sample words come from <film>/narration.py and <film>/audio/vo; UI cues from
<film>/audio/cues-<cut>-<lang>.json (scripts/cues.mjs).
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np

from narration import SR, decode, load, speech_span
from sfx import Track, make_sfx

# dB per UI cue, about 20 dB under the voice; the app's chimes and spoken sample words sit higher.
GAINS = {"key": -24, "erase": -22, "tap": -20, "swipe": -26, "swoosh": -26, "whoosh": -26, "pop": -24, "bubble": -24,
         "tick": -24, "check": -14, "chime": -14, "wrong": -18, "hit": -20}
WORD_GAIN = -5


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x**2)) + 1e-9)


def smooth(env, seconds):
    n = max(1, int(seconds * SR))
    return np.convolve(env, np.ones(n, np.float32) / n, "same")


def level(clip, target_db=-20):
    return clip * 10 ** ((target_db - rms_db(clip[np.abs(clip) > 0.01])) / 20)


def main():
    film, cut, lang, music_path, out = sys.argv[1:6]
    rows = load(film).CUTS[cut]
    cues = json.load(open(os.path.join(film, f"audio/cues-{cut}-{lang}.json")))
    dur = cues["duration"]
    n = int(dur * SR)

    vo = np.zeros((n, 2), np.float32)
    active = np.zeros(n, np.float32)
    for row in rows:
        clip = decode(os.path.join(film, f"audio/vo/{cut}-{lang}-{row[0]}.wav"))[:, 0]
        start, end = speech_span(clip)
        clip = level(clip[max(0, start - int(0.03 * SR)) : end + int(0.12 * SR)])
        f = int(0.01 * SR)
        clip[:f] *= np.linspace(0, 1, f)
        clip[-f:] *= np.linspace(1, 0, f)
        s0 = int(row[1] * SR)
        e = min(n, s0 + len(clip))
        vo[s0:e] += clip[: e - s0, None]
        active[s0:e] = 1

    lvl = 10 * np.log10(smooth(vo[:, 0] ** 2, 0.3) + 1e-10)
    g = 10 ** ((-(np.maximum(0, lvl + 30) / 2) + np.where(lvl > -30, 5, 0)) / 20)
    vo *= smooth(g, 0.05)[:, None]

    # Music holds one level and dips only under the voice: dips by section read as a glitch.
    mus = decode(music_path, 2)[:n]
    if len(mus) < n:
        mus = np.concatenate([mus, np.zeros((n - len(mus), 2), np.float32)])
    gain = 1 / np.sqrt(np.maximum(smooth(mus.mean(1) ** 2, 3.0), 1e-6))
    mus *= np.clip(gain / np.median(gain), 10 ** (-4 / 20), 10 ** (4 / 20))[:, None]
    mus *= 10 ** ((-27 - rms_db(mus[int(2 * SR) : -int(4 * SR)])) / 20)
    duck = smooth(np.minimum(1, smooth(active, 0.25) * 4), 0.35)
    mus *= (10 ** (-7 * duck / 20))[:, None]
    mus *= (10 ** (-3 * np.clip((np.arange(n) / SR - (dur - 16)) / 2, 0, 1) / 20))[:, None]
    fade = int(1.5 * SR)
    mus[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2

    track = Track(dur)
    sounds = make_sfx()
    for c in cues["cues"]:
        name = c["name"]
        if name.startswith("word-"):
            track.add(level(decode(os.path.join(film, f"audio/vo/{name}.wav"))[:, 0]), c["t"], gain=WORD_GAIN)
            continue
        sound = sounds[name]()
        sig, offset = sound if isinstance(sound, tuple) else (sound, 0.0)
        track.add(sig, c["t"] - offset, gain=GAINS.get(name, -20))

    mix = vo + mus + track.sfx[:n]
    mix /= max(1e-6, np.abs(mix).max()) / 0.7
    raw = out + ".raw.wav"
    w = wave.open(raw, "wb")
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
    w.close()

    target = "loudnorm=I=-14:TP=-1.5:LRA=11"
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", raw, "-af", f"{target}:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True, check=True)
    m = json.loads(p.stderr[p.stderr.rindex("{") : p.stderr.rindex("}") + 1])
    af = (f"{target}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
          f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af", af, "-ar", str(SR), "-c:a", "pcm_s24le", out], check=True)
    os.remove(raw)
    print(out, "input", m["input_i"], "LUFS")


if __name__ == "__main__":
    main()
