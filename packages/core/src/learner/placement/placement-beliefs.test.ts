import { describe, expect, it } from "vitest";
import { countRightAnswersToKnow } from "./placement-beliefs";

describe(countRightAnswersToKnow, () => {
  it("needs more right answers where a guess passes more often", () => {
    expect(countRightAnswersToKnow("typed")).toBe(1);
    expect(countRightAnswersToKnow("multipleChoice")).toBe(2);
    expect(countRightAnswersToKnow("trueFalse")).toBe(3);
  });
});
