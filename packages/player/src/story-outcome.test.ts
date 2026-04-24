import { describe, expect, test } from "vitest";
import { getStoryOutcomeDisplayTier } from "./story-outcome";

describe(getStoryOutcomeDisplayTier, () => {
  test("maps all strong choices to perfect", () => {
    expect(getStoryOutcomeDisplayTier(["strong", "strong", "strong"])).toBe("perfect");
  });

  test("maps all weak choices to terrible", () => {
    expect(getStoryOutcomeDisplayTier(["weak", "weak", "weak"])).toBe("terrible");
  });

  test("maps partial-heavy choices to ok", () => {
    expect(getStoryOutcomeDisplayTier(["partial", "partial", "partial"])).toBe("ok");
  });

  test("maps mostly strong choices to good", () => {
    expect(getStoryOutcomeDisplayTier(["strong", "strong", "partial"])).toBe("good");
  });

  test("maps weak choices with one partial save to bad", () => {
    expect(getStoryOutcomeDisplayTier(["weak", "weak", "partial"])).toBe("bad");
  });

  test("falls back to the weakest authored outcome without story choices", () => {
    expect(getStoryOutcomeDisplayTier([])).toBe("terrible");
  });
});
