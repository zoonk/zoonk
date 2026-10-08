/* oxlint-disable no-magic-numbers -- A WAV header is fixed byte offsets and sizes. */
import { type VoiceText } from "@zoonk/learn/speech/provider";
import { onTestFinished, vi } from "vitest";

const SAMPLE_RATE = 8000;
const WAV_HEADER_BYTES = 44;
const SILENCE = 128;
const TONE = 40;
const TONE_PERIOD = 20;

/** A short, quiet 8-bit WAV the browser really plays and ends, so clips follow each other. */
function wavClip(seconds: number): Blob {
  const samples = Math.round(SAMPLE_RATE * seconds);
  const bytes = new Uint8Array(WAV_HEADER_BYTES + samples);
  const view = new DataView(bytes.buffer);
  const encoder = new TextEncoder();

  bytes.set(encoder.encode("RIFF"), 0);
  view.setUint32(4, bytes.byteLength - 8, true);
  bytes.set(encoder.encode("WAVEfmt "), 8);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  bytes.set(encoder.encode("data"), 36);
  view.setUint32(40, samples, true);

  bytes.set(
    Array.from({ length: samples }, (_, index) =>
      index % TONE_PERIOD < TONE_PERIOD / 2 ? SILENCE + TONE : SILENCE - TONE,
    ),
    WAV_HEADER_BYTES,
  );

  return new Blob([bytes], { type: "audio/wav" });
}

/**
 * Stands in for the app's speech clips endpoint: each text gets its own short clip, ready at once
 * unless a test answers differently. `textOf` says which text a played file reads.
 */
export function speechClips({ seconds = 0.15 }: { seconds?: number } = {}) {
  const texts = new Map<string, string>();

  const clipFor = (text: string) => {
    const url = URL.createObjectURL(wavClip(seconds));
    texts.set(url, text);
    return url;
  };

  const voice = vi.fn<VoiceText>(async ({ text }) => ({ status: "ready", url: clipFor(text) }));

  return { textOf: (url: string) => texts.get(url), voice };
}

type PlayedClip = { preservesPitch: boolean; rate: number; src: string };

/**
 * Records each clip the page starts playing, with its speed, as it starts (one audio element plays
 * them all, so its state changes from clip to clip). The silent clip that unlocks playback on
 * mobile Safari isn't a clip, so it's left out.
 */
export function recordPlayedClips(): PlayedClip[] {
  const played: PlayedClip[] = [];
  // oxlint-disable-next-line typescript/unbound-method -- It's called with the element as `this`.
  const play = HTMLMediaElement.prototype.play;

  const spy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function recordPlay(
    this: HTMLMediaElement,
  ) {
    if (!this.src.startsWith("data:")) {
      played.push({ preservesPitch: this.preservesPitch, rate: this.playbackRate, src: this.src });
    }

    return play.call(this);
  });

  onTestFinished(() => spy.mockRestore());
  return played;
}
