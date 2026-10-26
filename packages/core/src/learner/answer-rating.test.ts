import { describe, expect, it } from "vitest";
import { gradeLessonAnswers, isUnaidedRecall, rateAnswer } from "./answer-rating";

describe(rateAnswer, () => {
  it("rates a wrong answer Again", () => {
    expect(rateAnswer({ durationMs: 10_000, isCorrect: false })).toBe("again");
  });

  it("rates help, partial credit or a slow answer Hard", () => {
    expect(rateAnswer({ durationMs: 10_000, isCorrect: true, usedHint: true })).toBe("hard");
    expect(rateAnswer({ durationMs: 10_000, isCorrect: true, score: 0.75 })).toBe("hard");
    // A right answer that left out most key points still showed the idea: Hard, never a lapse.
    expect(rateAnswer({ durationMs: 10_000, isCorrect: true, score: 0.4 })).toBe("hard");
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

/** A lesson's grade from its screens' first answers, for lessons that have some. */
function gradeLesson(firstAnswers: boolean[]) {
  const grade = gradeLessonAnswers(firstAnswers);

  if (!grade) {
    throw new Error("Expected a grade");
  }

  return grade;
}

describe(gradeLessonAnswers, () => {
  it("rates a lesson by its screens right the first time, never by its pace", () => {
    expect(rateAnswer(gradeLesson([true, true, true, true, true, true, true, true]))).toBe("good");
    expect(rateAnswer(gradeLesson([true, true, true, false]))).toBe("hard");
    expect(rateAnswer(gradeLesson([true, false, false]))).toBe("again");
  });

  it("counts a lesson all right as a recall and one with a miss as not", () => {
    expect(isUnaidedRecall(gradeLesson([true, true]))).toBe(true);
    expect(isUnaidedRecall(gradeLesson([true, false]))).toBe(false);
  });

  it("has no grade for a lesson without answers", () => {
    expect(gradeLessonAnswers([])).toBeNull();
  });
});
