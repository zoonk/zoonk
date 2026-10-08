import { describe, expect, it } from "vitest";
import { convertWavToMp3 } from "./convert-wav-to-mp3";

const SAMPLE_RATE = 24_000;
const BITS_PER_SAMPLE = 16;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;
const WAV_HEADER_BYTES = 44;

/**
 * Builds mono PCM WAV fixtures so these tests exercise the real provider WAV
 * decoder, audibility check, and WASM MP3 encoder as one conversion boundary.
 */
function createWavAudio({
  amplitude,
  durationSeconds,
}: {
  amplitude: number;
  durationSeconds: number;
}): Uint8Array {
  const samples = SAMPLE_RATE * durationSeconds;
  const dataBytes = samples * BYTES_PER_SAMPLE;
  const audio = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const dataView = new DataView(audio.buffer);

  audio.set(new TextEncoder().encode("RIFF"), 0);
  dataView.setUint32(4, audio.byteLength - 8, true);
  audio.set(new TextEncoder().encode("WAVEfmt "), 8);
  dataView.setUint32(16, 16, true);
  dataView.setUint16(20, 1, true);
  dataView.setUint16(22, 1, true);
  dataView.setUint32(24, SAMPLE_RATE, true);
  dataView.setUint32(28, SAMPLE_RATE * BYTES_PER_SAMPLE, true);
  dataView.setUint16(32, BYTES_PER_SAMPLE, true);
  dataView.setUint16(34, BITS_PER_SAMPLE, true);
  audio.set(new TextEncoder().encode("data"), 36);
  dataView.setUint32(40, dataBytes, true);

  const sampleData = Int16Array.from({ length: samples }, () => amplitude);
  audio.set(new Uint8Array(sampleData.buffer), WAV_HEADER_BYTES);

  return audio;
}

describe(convertWavToMp3, () => {
  it("encodes audible WAV into a smaller MP3 and says how long it plays", async () => {
    const wavAudio = createWavAudio({ amplitude: 1000, durationSeconds: 1 });

    const { audio: mp3Audio, durationSeconds } = await convertWavToMp3({
      audio: wavAudio,
      maxSeconds: 18,
      model: "google/gemini-3.8-flash-tts",
    });

    expect(mp3Audio.byteLength).toBeLessThan(wavAudio.byteLength);
    expect(mp3Audio[0]).toBe(255);
    expect(mp3Audio[1]).toBeGreaterThanOrEqual(224);
    expect(durationSeconds).toBe(1);
  });

  it("rejects audio longer than the text could take to read", async () => {
    const wavAudio = createWavAudio({ amplitude: 1000, durationSeconds: 3 });

    await expect(
      convertWavToMp3({ audio: wavAudio, maxSeconds: 2, model: "google/gemini-3.8-flash-tts" }),
    ).rejects.toThrow("returned audio longer than 2 seconds");
  });

  it("rejects silent WAV before encoding", async () => {
    const wavAudio = createWavAudio({ amplitude: 0, durationSeconds: 1 });

    await expect(
      convertWavToMp3({ audio: wavAudio, maxSeconds: 18, model: "google/gemini-3.8-flash-tts" }),
    ).rejects.toThrow("returned silent audio");
  });

  it("rejects malformed WAV", async () => {
    await expect(
      convertWavToMp3({
        audio: new Uint8Array([1, 2, 3]),
        maxSeconds: 18,
        model: "google/gemini-3.8-flash-tts",
      }),
    ).rejects.toThrow("returned invalid WAV audio");
  });
});
