import { describe, expect, it } from "vitest";
import { getBuddyEnergyState, getBuddyGlow, getNextBuddyStage } from "./buddy";

describe(getBuddyEnergyState, () => {
  it("naps while Energy is low", () => {
    expect(getBuddyEnergyState(0)).toBe("napping");
    expect(getBuddyEnergyState(15)).toBe("napping");
    expect(getBuddyEnergyState(29.9)).toBe("napping");
  });

  it("is awake in the middle range", () => {
    expect(getBuddyEnergyState(30)).toBe("awake");
    expect(getBuddyEnergyState(55)).toBe("awake");
    expect(getBuddyEnergyState(79.9)).toBe("awake");
  });

  it("glows when Energy is high", () => {
    expect(getBuddyEnergyState(80)).toBe("glowing");
    expect(getBuddyEnergyState(100)).toBe("glowing");
  });

  it("never naps on a day the learner studied, so learning wakes it", () => {
    expect(getBuddyEnergyState(2, { studiedToday: true })).toBe("awake");
    expect(getBuddyEnergyState(85, { studiedToday: true })).toBe("glowing");
    expect(getBuddyEnergyState(2, { studiedToday: false })).toBe("napping");
  });

  it("treats out-of-range Energy as the nearest bound", () => {
    expect(getBuddyEnergyState(-5)).toBe("napping");
    expect(getBuddyEnergyState(140)).toBe("glowing");
  });
});

describe(getNextBuddyStage, () => {
  it("names the next stage and the belt that brings it", () => {
    expect(getNextBuddyStage("white")).toStrictEqual({ belt: "orange", stage: "young" });
    expect(getNextBuddyStage("yellow")).toStrictEqual({ belt: "orange", stage: "young" });
    expect(getNextBuddyStage("green")).toStrictEqual({ belt: "blue", stage: "adult" });
    expect(getNextBuddyStage("brown")).toStrictEqual({ belt: "red", stage: "wise" });
    expect(getNextBuddyStage("black")).toBeNull();
  });
});

describe(getBuddyGlow, () => {
  it("scales Energy to a 0 to 1 glow", () => {
    expect(getBuddyGlow(0)).toBe(0);
    expect(getBuddyGlow(55)).toBe(0.55);
    expect(getBuddyGlow(100)).toBe(1);
  });

  it("clamps out-of-range Energy", () => {
    expect(getBuddyGlow(-10)).toBe(0);
    expect(getBuddyGlow(250)).toBe(1);
  });
});
