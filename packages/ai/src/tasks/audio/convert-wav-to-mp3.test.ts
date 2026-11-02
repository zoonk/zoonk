import { describe, expect, it } from "vitest";
import { createWavAudio } from "./_test-utils/wav-fixture";
import { convertWavToMp3 } from "./convert-wav-to-mp3";

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
