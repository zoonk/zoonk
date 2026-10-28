import { type SpeechModelName } from "./speech-models";

/** Both providers return 24 kHz, 16-bit mono WAV. */
const WAV_BYTES_PER_SECOND = 48_000;
const WAV_HEADER_ALLOWANCE_BYTES = 1024;

/** Even a one-letter clip may take this long, with the pauses a voice leaves around it. */
const MIN_MAX_SECONDS = 18;

/** Slower than any voice reads aloud, so audio longer than this means the model read something else. */
const MIN_CHARACTERS_PER_SECOND = 8;

/**
 * A model that reads its instructions aloud, or keeps talking, returns far more audio than the text
 * needs, so longer audio falls through to the next model.
 */
export function getMaxSeconds(text: string): number {
  return Math.max(MIN_MAX_SECONDS, Math.ceil(text.length / MIN_CHARACTERS_PER_SECOND));
}

export function assertExpectedAudioSize({
  audio,
  maxSeconds,
  model,
}: {
  audio: Uint8Array;
  maxSeconds: number;
  model: SpeechModelName;
}) {
  const maxBytes = maxSeconds * WAV_BYTES_PER_SECOND + WAV_HEADER_ALLOWANCE_BYTES;

  if (audio.byteLength <= maxBytes) {
    return;
  }

  throw new Error(
    `${model} returned oversized audio: ${audio.byteLength} bytes. Expected at most ${maxBytes} bytes.`,
  );
}
