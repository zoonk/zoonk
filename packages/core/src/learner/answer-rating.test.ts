import { describe, expect, it } from "vitest";
import { isUnaidedRecall, rateAnswer } from "./answer-rating";

describe(rateAnswer, () => {
  it("rates a wrong answer Again", () => {
    expect(rateAnswer({ durationMs: 10_000, isCorrect: false })).toBe("again");
  });

  it("rates less than half the key points Again even when marked right", () => {
    expect(rateAnswer({ durationMs: 10_000, isCorrect: true, score: 0.4 })).toBe("again");
  });

  it("rates help, partial credit or a slow answer Hard", () => {
    expect(rateAnswer({ durationMs: 10_000, isCorrect: true, usedHint: true })).toBe("hard");
    expect(rateAnswer({ durationMs: 10_000, isCorrect: true, score: 0.75 })).toBe("hard");
    expect(rateAnswer({ durationMs: 50_000, isCorrect: true })).toBe("hard");
  });

  it("rates a fast right answer Easy and a plain one Good", () => {
    expect(rateAnswer({ durationMs: 5000, isCorrect: true })).toBe("easy");
    expect(rateAnswer({ durationMs: 15_000, isCorrect: true })).toBe("good");
  });

  it("measures speed against the question's expected time", () => {
    expect(rateAnswer({ durationMs: 50_000, expectedDurationMs: 60_000, isCorrect: true })).toBe(
      "good",
    );

    expect(rateAnswer({ durationMs: 20_000, expectedDurationMs: 60_000, isCorrect: true })).toBe(
      "easy",
    );
  });
});

describe(isUnaidedRecall, () => {
  it("counts only right answers with full credit and no help", () => {
    expect(isUnaidedRecall({ durationMs: 1000, isCorrect: true })).toBe(true);
    expect(isUnaidedRecall({ durationMs: 1000, isCorrect: true, score: 1 })).toBe(true);
    expect(isUnaidedRecall({ durationMs: 1000, isCorrect: true, score: 0.8 })).toBe(false);
    expect(isUnaidedRecall({ durationMs: 1000, isCorrect: true, usedHint: true })).toBe(false);
    expect(isUnaidedRecall({ durationMs: 1000, isCorrect: false })).toBe(false);
  });
});
