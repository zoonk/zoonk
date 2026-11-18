import { describe, expect, it } from "vitest";
import { hasNothingToSwitch } from "./goal-switch-options";

describe(hasNothingToSwitch, () => {
  it("is the plain start row with no goals at all", () => {
    expect(hasNothingToSwitch({ goals: [], waitingGoals: [] })).toBe(true);
  });

  it("is the plain start row when the only goals are quick explanations", () => {
    expect(hasNothingToSwitch({ goals: [{ kind: "explain" }], waitingGoals: [] })).toBe(true);
  });

  it("opens the menu for a followed goal", () => {
    expect(
      hasNothingToSwitch({ goals: [{ kind: "explain" }, { kind: "learn" }], waitingGoals: [] }),
    ).toBe(false);
  });

  it("opens the menu for a goal waiting to start", () => {
    expect(hasNothingToSwitch({ goals: [], waitingGoals: [{}] })).toBe(false);
  });
});
