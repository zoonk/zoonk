import { pcmToWav } from "./pcm-wav";

/** Speech models speak 16-bit mono PCM at 24 kHz. */
const SPEECH_SAMPLE_RATE = 24_000;

/**
 * Builds mono 24 kHz PCM WAV fixtures, the shape the speech models return, so tests exercise the
 * real WAV decoder, audibility check and MP3 encoder.
 */
export function createWavAudio({
  amplitude,
  durationSeconds,
}: {
  amplitude: number;
  durationSeconds: number;
}): Uint8Array {
  const sampleData = Int16Array.from(
    { length: SPEECH_SAMPLE_RATE * durationSeconds },
    () => amplitude,
  );

  return pcmToWav(new Uint8Array(sampleData.buffer));
}
