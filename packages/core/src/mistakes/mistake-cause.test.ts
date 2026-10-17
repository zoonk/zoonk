import { describe, expect, it } from "vitest";
import { type MistakeSignals, inferMistakeCause } from "./mistake-cause";

const QUESTION = "A shirt costs $40 and is 25% off. How much do you pay after the discount?";

function signals(overrides: Partial<MistakeSignals>): MistakeSignals {
  return {
    durationMs: 20_000,
    misconception: null,
    questionText: QUESTION,
    recentSkillAnswers: { correct: 3, total: 5 },
    skillState: "learning",
    ...overrides,
  };
}

describe(inferMistakeCause, () => {
  it("names running out of time from the time limit", () => {
    expect(inferMistakeCause(signals({ durationMs: 90_000, timeLimitMs: 90_000 }))).toBe("time");
  });

  it("names a guess when the answer came faster than reading the question", () => {
    expect(inferMistakeCause(signals({ durationMs: 800 }))).toBe("guess");
  });

  it("names a trap when a strong learner picks a tagged distractor", () => {
    expect(
      inferMistakeCause(
        signals({ misconception: "Discounts the wrong base", skillState: "solid" }),
      ),
    ).toBe("trap");
  });

  it("names a misreading when a strong learner misses without a tagged distractor", () => {
    expect(inferMistakeCause(signals({ recentSkillAnswers: { correct: 9, total: 10 } }))).toBe(
      "misread",
    );
  });

  it("names a content gap while the skill is new or mostly missed", () => {
    expect(inferMistakeCause(signals({ skillState: "new" }))).toBe("gap");

    expect(inferMistakeCause(signals({ recentSkillAnswers: { correct: 1, total: 5 } }))).toBe(
      "gap",
    );

    expect(inferMistakeCause(signals({ recentSkillAnswers: { correct: 1, total: 2 } }))).toBe(
      "gap",
    );
  });

  it("leaves a mixed record to the classifier", () => {
    expect(inferMistakeCause(signals({ misconception: "Discounts the wrong base" }))).toBeNull();
  });
});
