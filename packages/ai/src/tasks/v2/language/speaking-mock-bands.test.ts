import { describe, expect, it } from "vitest";
import { getMinRangeWidth, getOverallBand, normalizeBandRange } from "./speaking-mock-bands";

describe(normalizeBandRange, () => {
  it("keeps a valid range as it is", () => {
    expect(normalizeBandRange({ bandHigh: 6.5, bandLow: 6, exam: "ielts" })).toStrictEqual({
      bandHigh: 6.5,
      bandLow: 6,
    });
  });

  it("puts the low end first", () => {
    expect(normalizeBandRange({ bandHigh: 5, bandLow: 6, exam: "ielts" })).toStrictEqual({
      bandHigh: 6,
      bandLow: 5,
    });
  });

  it("snaps to half bands and keeps the range on the IELTS scale", () => {
    expect(normalizeBandRange({ bandHigh: 6.7, bandLow: 6.2, exam: "ielts" })).toStrictEqual({
      bandHigh: 6.5,
      bandLow: 6,
    });

    expect(normalizeBandRange({ bandHigh: 10, bandLow: 8.5, exam: "ielts" })).toStrictEqual({
      bandHigh: 9,
      bandLow: 8.5,
    });

    expect(normalizeBandRange({ bandHigh: 0.5, bandLow: -1, exam: "ielts" })).toStrictEqual({
      bandHigh: 0.5,
      bandLow: 0,
    });
  });

  it("keeps a TOEFL range on its 1 to 6 scale", () => {
    expect(normalizeBandRange({ bandHigh: 7, bandLow: 5.5, exam: "toefl" })).toStrictEqual({
      bandHigh: 6,
      bandLow: 5.5,
    });

    expect(normalizeBandRange({ bandHigh: 1, bandLow: 0, exam: "toefl" })).toStrictEqual({
      bandHigh: 1,
      bandLow: 1,
    });

    expect(normalizeBandRange({ bandHigh: 4.3, bandLow: 3.8, exam: "toefl" })).toStrictEqual({
      bandHigh: 4.5,
      bandLow: 4,
    });
  });

  it("narrows a range wider than one band around its middle", () => {
    expect(normalizeBandRange({ bandHigh: 6, bandLow: 4, exam: "ielts" })).toStrictEqual({
      bandHigh: 5.5,
      bandLow: 4.5,
    });
  });

  it("widens a range narrower than the minimum width", () => {
    expect(
      normalizeBandRange({ bandHigh: 6, bandLow: 6, exam: "ielts", minWidth: 1 }),
    ).toStrictEqual({ bandHigh: 6.5, bandLow: 5.5 });
  });

  it("widens inside the scale at its ends", () => {
    expect(
      normalizeBandRange({ bandHigh: 9, bandLow: 9, exam: "ielts", minWidth: 1 }),
    ).toStrictEqual({ bandHigh: 9, bandLow: 8 });

    expect(
      normalizeBandRange({ bandHigh: 0, bandLow: 0, exam: "ielts", minWidth: 1 }),
    ).toStrictEqual({ bandHigh: 1, bandLow: 0 });

    expect(
      normalizeBandRange({ bandHigh: 1, bandLow: 1, exam: "toefl", minWidth: 1 }),
    ).toStrictEqual({ bandHigh: 2, bandLow: 1 });

    expect(
      normalizeBandRange({ bandHigh: 6, bandLow: 6, exam: "toefl", minWidth: 1 }),
    ).toStrictEqual({ bandHigh: 6, bandLow: 5 });
  });
});

describe(getMinRangeWidth, () => {
  it("gives a full band only to how the candidate sounds", () => {
    expect(getMinRangeWidth({ criterion: "pronunciation", exam: "ielts" })).toBe(1);
    expect(getMinRangeWidth({ criterion: "delivery", exam: "toefl" })).toBe(1);
    expect(getMinRangeWidth({ criterion: "grammar", exam: "toefl" })).toBe(0);
    expect(getMinRangeWidth({ criterion: "repetition", exam: "toefl" })).toBe(0);
  });
});

describe(getOverallBand, () => {
  it("averages the four IELTS criteria to the nearest half band", () => {
    expect(
      getOverallBand({
        criteria: [
          { bandHigh: 6.5, bandLow: 6, criterion: "fluencyCoherence" },
          { bandHigh: 6, bandLow: 5.5, criterion: "lexicalResource" },
          { bandHigh: 6, bandLow: 5.5, criterion: "grammar" },
          { bandHigh: 6.5, bandLow: 5.5, criterion: "pronunciation" },
        ],
        exam: "ielts",
      }),
    ).toStrictEqual({ bandHigh: 6.5, bandLow: 5.5 });
  });

  it("weighs TOEFL's Listen and Repeat by its 7 of 11 items", () => {
    const interview = [
      { bandHigh: 3.5, bandLow: 3, criterion: "elaboration" as const },
      { bandHigh: 3.5, bandLow: 3, criterion: "grammar" as const },
      { bandHigh: 3.5, bandLow: 3, criterion: "vocabulary" as const },
      { bandHigh: 4, bandLow: 3, criterion: "delivery" as const },
    ];

    expect(
      getOverallBand({
        criteria: [{ bandHigh: 5, bandLow: 4.5, criterion: "repetition" }, ...interview],
        exam: "toefl",
      }),
    ).toStrictEqual({ bandHigh: 4.5, bandLow: 4 });
  });

  it("rounds TOEFL's weighted mean to the nearest half band", () => {
    const interview = (["elaboration", "grammar", "vocabulary", "delivery"] as const).map(
      (criterion) => ({ bandHigh: 5, bandLow: 5, criterion }),
    );

    // (7 × 5.5 + 4 × 5) / 11 = 5.32, nearer 5.5 than 5
    expect(
      getOverallBand({
        criteria: [{ bandHigh: 5.5, bandLow: 5, criterion: "repetition" }, ...interview],
        exam: "toefl",
      }),
    ).toStrictEqual({ bandHigh: 5.5, bandLow: 5 });
  });
});
