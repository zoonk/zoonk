import { parseCefrScore } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { getBandFill, getLevelShare, listRises } from "./level-scale";

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
  const trend = score > (parseCefrScore(startLabel) ?? score) ? "up" : "same";
  return { score, skill, startLabel, trend };
}

describe(listRises, () => {
  it("lists every skill that rose since the level test, the biggest rise first", () => {
    const levels = [
      level("reading", 2, "B1"),
      level("speaking", 1.5, "A2"),
      level("listening", 2, "A2"),
      level("writing", 1.5, "A2"),
    ];

    expect(listRises(levels).map((rise) => rise.skill)).toStrictEqual([
      "listening",
      "speaking",
      "writing",
    ]);
  });

  it("is empty when nothing rose", () => {
    expect(listRises([level("reading", 1, "A2"), level("writing", 0.5, "A2")])).toStrictEqual([]);
  });
});
