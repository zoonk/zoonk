import { describe, expect, it } from "vitest";
import { getReached } from "./reached";

const SAME_ENERGY = { after: 50, before: 50 };

const SAME_BRAIN_POWER = { after: 10, before: 10 };

function energyOf(energy: { after: number; before: number }) {
  return getReached({ brainPower: SAME_BRAIN_POWER, energy }).energy;
}

describe(getReached, () => {
  it("names the level a block's Brain Power crossed into", () => {
    expect(
      getReached({ brainPower: { after: 260, before: 240 }, energy: SAME_ENERGY }),
    ).toStrictEqual({ energy: null, level: { color: "white", level: 2 } });
  });

  it("names the new belt when the Brain Power crossed into its first level", () => {
    expect(
      getReached({ brainPower: { after: 2510, before: 2490 }, energy: SAME_ENERGY }).level,
    ).toStrictEqual({ color: "yellow", level: 1 });
  });

  it("reaches no level while the Brain Power stays within one", () => {
    expect(
      getReached({ brainPower: { after: 249, before: 10 }, energy: SAME_ENERGY }).level,
    ).toBeNull();
  });

  it("names the highest tenth of Energy crossed going up", () => {
    expect(energyOf({ after: 81.4, before: 79.8 })).toBe(80);
    expect(energyOf({ after: 100, before: 99.6 })).toBe(100);
  });

  it("reaches no tenth within one, from exactly one, or going down", () => {
    expect(energyOf({ after: 79.9, before: 70.2 })).toBeNull();
    expect(energyOf({ after: 80.2, before: 80 })).toBeNull();
    expect(energyOf({ after: 59.9, before: 60.1 })).toBeNull();
    expect(energyOf({ after: 0.2, before: 0 })).toBeNull();
  });
});
