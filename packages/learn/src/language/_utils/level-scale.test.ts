import { describe, expect, it } from "vitest";
import { findBiggestRise, getBandFill, getLevelShare } from "./level-scale";

describe(getLevelShare, () => {
  it("puts a plain level in the middle of its band and a plus at its end", () => {
    expect(getLevelShare(0)).toBeCloseTo(0.5 / 6);
    expect(getLevelShare(2)).toBeCloseTo(2.5 / 6);
    expect(getLevelShare(2.5)).toBeCloseTo(3 / 6);
  });

  it("stays on the bar", () => {
    expect(getLevelShare(5)).toBe(1);
    expect(getLevelShare(-1)).toBe(0);
  });
});

describe(getBandFill, () => {
  it("fills the bands below the level and part of its own", () => {
    const fills = [0, 1, 2, 3].map((band) => getBandFill({ band, score: 2 }));
    expect(fills).toStrictEqual([1, 1, 0.5, 0]);
  });
});

function level(skill: string, score: number, startLabel: string) {
  return { score, skill, startLabel };
}

describe(findBiggestRise, () => {
  it("picks the skill that rose the most since the level test", () => {
    const levels = [
      level("reading", 2, "B1"),
      level("listening", 2, "A2"),
      level("speaking", 1.5, "A2"),
    ];

    expect(findBiggestRise(levels)?.skill).toBe("listening");
  });

  it("keeps the first skill on a tie", () => {
    const levels = [level("speaking", 1.5, "A2"), level("writing", 1.5, "A2")];
    expect(findBiggestRise(levels)?.skill).toBe("speaking");
  });

  it("is null when nothing rose", () => {
    expect(findBiggestRise([level("reading", 1, "A2"), level("writing", 0.5, "A2")])).toBeNull();
  });
});
