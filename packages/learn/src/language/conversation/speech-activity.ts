/**
 * Whether the learner is speaking, from their own microphone: their words come back as text only
 * 1.3 to 1.8 s later, too late to tell them they're heard or to keep the character's goodbye from
 * talking over them. It hears sound, not words, so a noisy room counts as speaking.
 */

import { SPEECH_LEVEL, listenToLevel } from "@zoonk/ui/lib/microphone-level";

const SAMPLE_MS = 100;
/** A voice dips between words; below the level this long and the learner stopped. */
const HANGOVER_MS = 1000;

/** `voiced`: this sample heard a voice; `speaking` also holds the hangover after one. */
export type SpeechSample = { at: number; speaking: boolean; voiced: boolean };

/** `context` must have been made during a tap, or Safari on iOS keeps it silent. */
export function sampleSpeech({
  context,
  onSample,
  stream,
}: {
  context: AudioContext;
  onSample: (sample: SpeechSample) => void;
  stream: MediaStream;
}) {
  const level = listenToLevel({ context, stream });
  let voicedAt: number | null = null;

  const timer = setInterval(() => {
    const at = Date.now();
    const voiced = level.read() >= SPEECH_LEVEL;

    if (voiced) {
      voicedAt = at;
    }

    onSample({ at, speaking: voicedAt !== null && at - voicedAt < HANGOVER_MS, voiced });
  }, SAMPLE_MS);

  return () => {
    clearInterval(timer);
    level.stop();
  };
}
