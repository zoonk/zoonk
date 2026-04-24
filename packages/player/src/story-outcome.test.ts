import { describe, expect, test } from "vitest";
import { getStoryOutcomeDisplayTier, getStoryOutcomeTier } from "./story-outcome";

describe(getStoryOutcomeTier, () => {
  test("maps all strong choices to perfect", () => {
    expect(getStoryOutcomeTier(["strong", "strong", "strong"])).toBe("perfect");
  });

  test("maps all weak choices to terrible", () => {
    expect(getStoryOutcomeTier(["weak", "weak", "weak"])).toBe("terrible");
  });

  test("maps partial-heavy choices to ok", () => {
    expect(getStoryOutcomeTier(["partial", "partial", "partial"])).toBe("ok");
  });

  test("maps mostly strong choices to good", () => {
    expect(getStoryOutcomeTier(["strong", "strong", "partial"])).toBe("good");
  });

  test("maps weak choices with one partial save to bad", () => {
    expect(getStoryOutcomeTier(["weak", "weak", "partial"])).toBe("bad");
  });

  test("returns null without story choices", () => {
    expect(getStoryOutcomeTier([])).toBeNull();
  });
});

describe(getStoryOutcomeDisplayTier, () => {
  test("falls back to the weakest authored outcome without story choices", () => {
    expect(getStoryOutcomeDisplayTier([])).toBe("terrible");
  });
});
