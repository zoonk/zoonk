import { describe, expect, it } from "vitest";
import { getSpeakingMockOverall } from "./speaking-mock-format";

function interviewAt(bandLow: number, bandHigh: number) {
  return ["elaboration", "grammar", "vocabulary", "delivery"].map((criterion) => ({
    bandHigh,
    bandLow,
    criterion,
  }));
}

describe(getSpeakingMockOverall, () => {
  it("averages the four IELTS criteria to the nearest half band", () => {
    const criteria = [
      { bandHigh: 6.5, bandLow: 6, criterion: "fluencyCoherence" },
      { bandHigh: 6, bandLow: 5.5, criterion: "lexicalResource" },
      { bandHigh: 6, bandLow: 5.5, criterion: "grammar" },
      { bandHigh: 6.5, bandLow: 5.5, criterion: "pronunciation" },
    ];

    expect(getSpeakingMockOverall({ criteria, exam: "ielts" })).toStrictEqual({
      bandHigh: 6.5,
      bandLow: 5.5,
    });
  });

  it("weighs TOEFL's Listen and Repeat by its 7 of 11 items, to the nearest half band", () => {
    const repetition = { bandHigh: 5.5, bandLow: 5, criterion: "repetition" };

    expect(
      getSpeakingMockOverall({ criteria: [repetition, ...interviewAt(5, 5)], exam: "toefl" }),
    ).toStrictEqual({ bandHigh: 5.5, bandLow: 5 });
  });

  it("leaves a criterion that wasn't rated out of the mean", () => {
    const repetition = { bandHigh: 4, bandLow: 4, criterion: "repetition" };
    const typed = interviewAt(3, 3).filter((item) => item.criterion !== "delivery");

    expect(
      getSpeakingMockOverall({ criteria: [repetition, ...typed], exam: "toefl" }),
    ).toStrictEqual({ bandHigh: 3.5, bandLow: 3.5 });
  });
});
