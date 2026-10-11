import { PCM_SAMPLE_RATE, pcmToWav } from "../pcm-wav";

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
    { length: PCM_SAMPLE_RATE * durationSeconds },
    () => amplitude,
  );

  return pcmToWav(new Uint8Array(sampleData.buffer));
}
