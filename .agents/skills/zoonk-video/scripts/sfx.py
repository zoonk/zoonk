"""UI sounds for the mix: the app's own lesson chimes and small synthesized taps, keys and swipes."""
import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def db(x):
    return 10 ** (x / 20)


class Track:
    """A stereo buffer that sounds are placed on by time."""

    def __init__(self, dur):
        self.sfx = np.zeros((int(dur * SR) + SR * 4, 2), np.float32)

    def add(self, sig, t, gain=0.0, pan=0.0):
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l * 1.414, sig * r * 1.414], 1)
        s0 = int(t * SR)
        if s0 < 0:
            sig = sig[-s0:]
            s0 = 0
        e = min(len(self.sfx), s0 + len(sig))
        self.sfx[s0:e] += sig[: e - s0] * db(gain)


def app_sound(kind):
    """The player's own lesson sounds, rebuilt from packages/player/src/lesson/_utils/lesson-sounds.ts."""
    notes = {"correct": [659.25, 880.0], "finish": [523.25, 659.25, 783.99]}[kind]
    step, attack, peak = 0.12, 0.03, 0.12
    out = np.zeros(int((step * len(notes) + step * 2 + 0.05) * SR), np.float32)
    for i, f in enumerate(notes):
        n = int(step * 2 * SR)
        t = np.arange(n) / SR
        env = np.where(t < attack, (peak / 1e-4) ** (t / attack) * 1e-4, peak * (1e-4 / peak) ** ((t - attack) / (step * 2 - attack)))
        s0 = int(i * step * SR)
        out[s0 : s0 + n] += (np.sin(2 * np.pi * f * t) * env).astype(np.float32)
    return out


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR)).astype(np.float32)


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x)).astype(np.float32)


IR = None


def reverb(x, wet=0.25, length=1.6):
    global IR
    if IR is None:
        n = int(length * SR)
        ir = rng.standard_normal(n).astype(np.float32) * env_exp(n, length / 6)
        IR = fft_filter(ir, lo=200, hi=7000)
        IR /= np.sqrt((IR**2).sum())
    n = len(x) + len(IR)
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(IR, n), n)[:n].astype(np.float32)
    out = np.zeros(n, np.float32)
    out[: len(x)] += x * (1 - wet)
    out += y * wet * 0.6
    return out


def click(hp=2500, tau=0.006, n_ms=30):
    n = int(n_ms / 1000 * SR)
    s = rng.standard_normal(n).astype(np.float32) * env_exp(n, tau)
    return fft_filter(s, lo=hp, hi=9000)


def glide(f0, f1, dur, tau):
    n = int(dur * SR)
    f = np.geomspace(f0, f1, n)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * env_exp(n, tau)).astype(np.float32)


def noise_sweep(dur, f0, f1, rise=True):
    """Noise through a band-pass that glides from f0 to f1 (STFT overlap-add, no block clicks)."""
    n = int(dur * SR)
    N, H = 2048, 512
    x = rng.standard_normal(n + N).astype(np.float32)
    win = np.hanning(N).astype(np.float32)
    out = np.zeros(n + N, np.float32)
    f = np.fft.rfftfreq(N, 1 / SR)
    for i in range(0, n, H):
        k = i / n
        fc = f0 * (f1 / f0) ** k
        m = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / 0.6) ** 2)
        out[i : i + N] += np.fft.irfft(np.fft.rfft(x[i : i + N] * win) * m, N).astype(np.float32) * win
    out = out[:n] / 1.5
    e = np.sin(np.pi * np.linspace(0, 1, n)) ** 2 if not rise else np.linspace(0, 1, n) ** 3
    return out * e


E4, Gs4 = 329.63, 415.3


def make_sfx():
    S = {}
    S["key"] = lambda: mix(click(hp=1800 + rng.random() * 1500, tau=0.004, n_ms=25) * 0.5, 0.12 * glide(2400 + rng.random() * 600, 2200, 0.02, 0.005))
    S["erase"] = lambda: sum_at([(click(2500, 0.004, 25) * 0.4, k * 0.05) for k in range(5)], 0.35)
    S["tap"] = lambda: mix(glide(950, 560, 0.08, 0.02) * 0.55, click(1200, 0.003, 20) * 0.35)
    S["swipe"] = lambda: noise_sweep(0.32, 900, 3200, rise=False) * 0.35
    S["swoosh"] = lambda: noise_sweep(0.6, 500, 2600, rise=False) * 0.45
    S["whoosh"] = lambda: noise_sweep(0.7, 300, 1800, rise=False) * 0.35
    S["pop"] = lambda: glide(520, 880, 0.09, 0.03) * 0.45
    S["bubble"] = lambda: glide(700, 1250, 0.07, 0.025) * 0.38
    S["tick"] = lambda: mix(click(4000, 0.003, 15) * 0.45, glide(3200, 3000, 0.015, 0.004) * 0.12)
    S["check"] = lambda: app_sound("correct")
    S["chime"] = lambda: app_sound("finish")
    S["wrong"] = lambda: sum_at([(glide(Gs4, Gs4 * 0.98, 0.18, 0.05) * 0.35, 0), (glide(E4, E4 * 0.97, 0.3, 0.08) * 0.35, 0.11)], 0.5)
    S["hit"] = lambda: hit()
    return S


def mix(*xs):
    out = np.zeros(max(len(x) for x in xs), np.float32)
    for x in xs:
        out[: len(x)] += x
    return out


def sum_at(parts, dur):
    out = np.zeros(int(dur * SR), np.float32)
    for x, t in parts:
        s = int(t * SR)
        e = min(len(out), s + len(x))
        out[s:e] += x[: e - s]
    return out


def hit():
    # swell that ends on the downbeat, then a soft low boom with an air tail
    sw = noise_sweep(1.6, 400, 6000, rise=True) * 0.22
    n = int(2.4 * SR)
    boom = glide(95, 48, 2.4, 0.5) * 0.55
    air = fft_filter(rng.standard_normal(n).astype(np.float32), lo=3000, hi=12000) * env_exp(n, 0.5) * 0.05
    tail = reverb(boom + air, 0.35)
    out = np.zeros(len(sw) + len(tail), np.float32)
    out[: len(sw)] += sw
    out[len(sw) :] += tail
    return out, len(sw) / SR  # offset: lands on the cue time
