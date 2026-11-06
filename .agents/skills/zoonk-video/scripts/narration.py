"""A film's narration (<film>/narration.py): the speech spec, the timing check and the captions.

usage:
  python3 scripts/narration.py <film> spec <out.json>          every line and sample word, for gen-audio.mjs and transcribe.mjs
  python3 scripts/narration.py <film> fit [-v]                 lines whose speech runs past their window
  python3 scripts/narration.py <film> srt <cut> <lang> <out>   captions from the clips' real speech spans

Clips live in <film>/audio/vo/<cut>-<lang>-<id>.wav and <film>/audio/vo/<word id>.wav.
"""
import importlib.util
import json
import os
import subprocess
import sys

import numpy as np

SR = 48000


def load(film):
    spec = importlib.util.spec_from_file_location("narration", os.path.join(film, "narration.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def decode(path, channels=1):
    """Any audio file -> float32 samples at 48 kHz."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", str(channels), "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, channels).copy()


def speech_span(samples):
    """First and last sample of the speech in a clip, ignoring the model's silent padding."""
    n = int(0.02 * SR)
    env = np.convolve(np.abs(samples), np.ones(n) / n, "same")
    idx = np.where(env > 0.01)[0]
    return (int(idx[0]), int(idx[-1])) if len(idx) else (0, 0)


def clip_path(film, cut, lang, line_id):
    return os.path.join(film, "audio/vo", f"{cut}-{lang}-{line_id}.wav")


def text(n, row, lang):
    return row[3 + n.LANGS.index(lang)]


def spec(film, out):
    n = load(film)
    tone = getattr(n, "TONE", {})
    clips = [
        {"id": f"{cut}-{lang}-{row[0]}", "model": n.MODEL, "voice": n.VOICE,
         "instructions": " ".join(filter(None, [n.INSTR[lang], tone.get(row[0], {}).get(lang)])),
         "text": text(n, row, lang), "outputFormat": "wav"}
        for cut, rows in n.CUTS.items()
        for lang in n.LANGS
        for row in rows
    ]
    clips += [{"model": n.MODEL, "outputFormat": "wav", **w} for w in getattr(n, "WORDS", [])]
    json.dump(clips, open(out, "w"), ensure_ascii=False, indent=1)
    print(len(clips), "clips ->", out)


def fit(film, verbose):
    """A line's window ends 0.15 s before the next line starts; the last line's ends at its scene end."""
    n = load(film)
    over = 0
    for cut, rows in n.CUTS.items():
        for lang in n.LANGS:
            for i, row in enumerate(rows):
                start, end = (s / SR for s in speech_span(decode(clip_path(film, cut, lang, row[0]))[:, 0]))
                window = (rows[i + 1][1] - 0.15 if i + 1 < len(rows) else row[2]) - row[1]
                late = end - start > window
                over += late
                if late or verbose:
                    print(f"{cut}-{lang}-{row[0]} speech {end - start:5.2f}s window {window:5.2f}s{' OVER' if late else ''}")
    print("over:", over)
    return over


def srt(film, cut, lang, out):
    n = load(film)

    def ts(t):
        ms = int(round(t * 1000))
        h, ms = divmod(ms, 3600000)
        m, ms = divmod(ms, 60000)
        s, ms = divmod(ms, 1000)
        return f"{h:02}:{m:02}:{s:02},{ms:03}"

    lines = []
    for i, row in enumerate(n.CUTS[cut]):
        start, end = (s / SR for s in speech_span(decode(clip_path(film, cut, lang, row[0]))[:, 0]))
        caption = text(n, row, lang)
        for spoken, written in getattr(n, "SPOKEN", {}).items():
            caption = caption.replace(spoken, written)
        lines.append(f"{i + 1}\n{ts(row[1])} --> {ts(row[1] + end - start + 0.3)}\n{caption}\n")
    open(out, "w").write("\n".join(lines))
    print(out, len(lines), "captions")


if __name__ == "__main__":
    film, command, *rest = sys.argv[1:]
    if command == "spec":
        spec(film, rest[0])
    elif command == "fit":
        sys.exit(1 if fit(film, "-v" in rest) else 0)
    elif command == "srt":
        srt(film, *rest)
    else:
        sys.exit(__doc__)
