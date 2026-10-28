import { describe, expect, it } from "vitest";
import { getLevelMark, getLevelStanding } from "./speaking-standing";

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
