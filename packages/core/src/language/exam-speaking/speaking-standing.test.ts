import { describe, expect, it } from "vitest";
import { getLevelMark, getLevelStanding, getSpeakingEstimate } from "./speaking-standing";

describe(getLevelMark, () => {
  it("is the band the scale names for the level, or 60% of a scale that names none", () => {
    expect(getLevelMark({ levelBand: 2, maxBand: 3 })).toBe(2);
    expect(getLevelMark({ levelBand: null, maxBand: 4 })).toBeCloseTo(2.4);
  });
});

describe(getLevelStanding, () => {
  it.each([
    [2, 2, "at"],
    [2, 3, "at"],
    [1, 2, "near"],
    [1, 1, "below"],
    [0, 1, "below"],
  ] as const)("reads DELE's %i to %i against band 2 as %s", (bandLow, bandHigh, standing) => {
    expect(getLevelStanding({ bandHigh, bandLow, levelMark: 2 })).toBe(standing);
  });

  it("reads Cambridge's half bands and Goethe's letters against their marks", () => {
    expect(getLevelStanding({ bandHigh: 3, bandLow: 2.5, levelMark: 3 })).toBe("near");
    expect(getLevelStanding({ bandHigh: 3.5, bandLow: 3, levelMark: 3 })).toBe("at");
    expect(getLevelStanding({ bandHigh: 3, bandLow: 2, levelMark: 2.4 })).toBe("at");
    expect(getLevelStanding({ bandHigh: 2, bandLow: 2, levelMark: 2.4 })).toBe("below");
  });
});

describe(getSpeakingEstimate, () => {
  const scale = { maxBand: 4, points: null };

  it("reads a band range on the scale's highest band", () => {
    expect(
      getSpeakingEstimate({ bandHigh: 3, bandLow: 2, criterion: { ...scale, display: "band" } }),
    ).toStrictEqual({ display: "band", high: 3, low: 2, max: 4 });
  });

  it("reads Goethe's bands as letters, A for the top band", () => {
    expect(
      getSpeakingEstimate({ bandHigh: 4, bandLow: 2, criterion: { ...scale, display: "letter" } }),
    ).toStrictEqual({ display: "letter", high: "A", low: "C" });
  });

  it("reads a points line as the points its rounded bands give, of the line's most", () => {
    const criterion = { display: "points" as const, maxBand: 3, points: [0, 1.5, 3, 4.5] };

    expect(getSpeakingEstimate({ bandHigh: 2.5, bandLow: 1, criterion })).toStrictEqual({
      display: "points",
      high: 4.5,
      low: 1.5,
      max: 4.5,
    });
  });

  it("falls back to the band when the task has no points line", () => {
    expect(
      getSpeakingEstimate({ bandHigh: 2, bandLow: 1, criterion: { ...scale, display: "points" } }),
    ).toStrictEqual({ display: "band", high: 2, low: 1, max: 4 });
  });
});
