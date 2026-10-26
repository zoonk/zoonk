import { describe, expect, it } from "vitest";
import { getEnergyReached, getLevelReached } from "./reached";

describe(getLevelReached, () => {
  it("names the level a block's Brain Power crossed into", () => {
    expect(getLevelReached({ after: 260, before: 240 })).toStrictEqual({
      color: "white",
      level: 2,
    });
  });

  it("names the new belt when the Brain Power crossed into its first level", () => {
    expect(getLevelReached({ after: 2510, before: 2490 })).toStrictEqual({
      color: "yellow",
      level: 1,
    });
  });

  it("reaches nothing while the Brain Power stays within a level", () => {
    expect(getLevelReached({ after: 249, before: 10 })).toBeNull();
  });
});

describe(getEnergyReached, () => {
  it("names the highest tenth crossed going up", () => {
    expect(getEnergyReached({ after: 81.4, before: 79.8 })).toBe(80);
    expect(getEnergyReached({ after: 100, before: 99.6 })).toBe(100);
  });

  it("reaches nothing within a tenth, from exactly a tenth, or going down", () => {
    expect(getEnergyReached({ after: 79.9, before: 70.2 })).toBeNull();
    expect(getEnergyReached({ after: 80.2, before: 80 })).toBeNull();
    expect(getEnergyReached({ after: 59.9, before: 60.1 })).toBeNull();
    expect(getEnergyReached({ after: 0.2, before: 0 })).toBeNull();
  });
});
