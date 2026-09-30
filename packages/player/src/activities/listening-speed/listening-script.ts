import { hashSeed, seededRandom } from "@zoonk/utils/seeded-random";

const MIN_BAR = 0.25;

/** The script as sentences, the way the language splits them, so replay can go one back. */
export function splitSentences(script: string, language: string): string[] {
  const segmenter = new Intl.Segmenter(language, { granularity: "sentence" });

  return [...segmenter.segment(script)].map((part) => part.segment.trim()).filter(Boolean);
}

/** Bar heights (0 to 1) for a voice-message waveform, the same for the same script. */
export function waveformBars(script: string, count: number): number[] {
  const random = seededRandom(hashSeed(script));
  return Array.from({ length: count }, () => MIN_BAR + random() * (1 - MIN_BAR));
}
