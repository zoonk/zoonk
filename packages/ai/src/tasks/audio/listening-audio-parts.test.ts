import { describe, expect, it } from "vitest";
import { joinSpeech, splitSpokenText } from "./listening-audio-parts";

const SAMPLE_RATE = 24_000;

function speech(seconds: number, sampleRate = SAMPLE_RATE) {
  const samples = new Float32Array(Math.round(seconds * sampleRate)).fill(0.5);

  return {
    channelCount: 1 as const,
    channelData: [samples],
    sampleRate,
    samplesDecoded: samples.length,
  };
}

describe(splitSpokenText, () => {
  it("keeps a short turn whole", () => {
    expect(splitSpokenText({ locale: "en", text: " Hi there. Can I help? " })).toStrictEqual([
      "Hi there. Can I help?",
    ]);
  });

  it("splits a long turn at sentence ends, never inside a sentence", () => {
    const sentence =
      "The library opens at nine and closes at six on weekdays, and later on Thursdays. ";

    const parts = splitSpokenText({ locale: "en", text: sentence.repeat(12) });

    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= 500)).toBe(true);
    expect(parts.join(" ")).toBe(sentence.repeat(12).trim());
  });

  it("splits languages written without spaces", () => {
    const sentence = "図書館は九時に開きます。";
    expect(splitSpokenText({ locale: "ja", text: sentence.repeat(60) }).length).toBeGreaterThan(1);
  });
});

describe(joinSpeech, () => {
  it("joins parts in order with a longer pause between speakers than inside a turn", () => {
    const joined = joinSpeech([
      { audio: speech(1), turn: 0 },
      { audio: speech(1), turn: 0 },
      { audio: speech(2), turn: 1 },
    ]);

    expect(joined.sampleRate).toBe(SAMPLE_RATE);
    expect(joined.samplesDecoded / SAMPLE_RATE).toBeCloseTo(1 + 0.25 + 1 + 0.6 + 2);
    expect(joined.channelData[0]?.[SAMPLE_RATE + 1]).toBe(0);
  });

  it("refuses parts at different sample rates", () => {
    expect(() =>
      joinSpeech([
        { audio: speech(1), turn: 0 },
        { audio: speech(1, 16_000), turn: 1 },
      ]),
    ).toThrow("different sample rates");
  });
});
