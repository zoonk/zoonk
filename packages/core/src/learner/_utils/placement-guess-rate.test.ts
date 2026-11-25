import { describe, expect, it } from "vitest";
import { getPlacementGuessRate, isQuickChoice } from "./placement-guess-rate";

describe("single-pick placement choices", () => {
  it.each([2, 3, 4, 5])("uses the real guess rate for %i options", (count) => {
    const item = {
      content: { options: Array.from({ length: count }, (_, index) => String(index)), select: 1 },
      format: "multipleChoice" as const,
    };

    expect(getPlacementGuessRate(item)).toBe(1 / count);
    expect(isQuickChoice(item)).toBe(count >= 3);
  });
});
