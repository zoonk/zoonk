import { describe, expect, it } from "vitest";
import { assertAudibleAudioSignal } from "./validate-audio-signal";

const SAMPLE_RATE = 48_000;

/**
 * Builds normalized decoded audio so each test can describe the signal rule it
 * exercises without coupling the rule to a particular source codec.
 */
function createDecodedAudio(channelData: Float32Array[]) {
  return { channelData, sampleRate: SAMPLE_RATE, samplesDecoded: channelData[0]?.length ?? 0 };
}

describe(assertAudibleAudioSignal, () => {
  it("accepts sustained audible speech", () => {
    const speech = new Float32Array(SAMPLE_RATE / 10).fill(0.1);

    expect(() =>
      assertAudibleAudioSignal({
        audio: createDecodedAudio([speech]),
        model: "openai/gpt-4o-mini-tts",
      }),
    ).not.toThrow();
  });

  it("rejects silent audio", () => {
    const silence = new Float32Array(SAMPLE_RATE / 10);

    expect(() =>
      assertAudibleAudioSignal({
        audio: createDecodedAudio([silence]),
        model: "openai/gpt-4o-mini-tts",
      }),
    ).toThrow("returned silent audio");
  });

  it("rejects an isolated loud click", () => {
    const click = new Float32Array(SAMPLE_RATE / 10);
    click[0] = 1;

    expect(() =>
      assertAudibleAudioSignal({
        audio: createDecodedAudio([click]),
        model: "openai/gpt-4o-mini-tts",
      }),
    ).toThrow("returned silent audio");
  });

  it("rejects audio longer than a learner phrase", () => {
    const longSpeech = new Float32Array(SAMPLE_RATE * 19).fill(0.1);

    expect(() =>
      assertAudibleAudioSignal({
        audio: createDecodedAudio([longSpeech]),
        model: "google/gemini-2.5-flash-preview-tts",
      }),
    ).toThrow("returned audio longer than 18 seconds");
  });

  it("rejects sustained near-silence below the calibrated production floor", () => {
    const nearSilence = new Float32Array(SAMPLE_RATE / 10).fill(0.0016);

    expect(() =>
      assertAudibleAudioSignal({
        audio: createDecodedAudio([nearSilence]),
        model: "openai/gpt-4o-mini-tts",
      }),
    ).toThrow("returned silent audio");
  });

  it("accepts quiet sustained speech above the calibrated production floor", () => {
    const quietSpeech = new Float32Array(SAMPLE_RATE / 20).fill(0.006);

    expect(() =>
      assertAudibleAudioSignal({
        audio: createDecodedAudio([quietSpeech]),
        model: "openai/gpt-4o-mini-tts",
      }),
    ).not.toThrow();
  });
});
