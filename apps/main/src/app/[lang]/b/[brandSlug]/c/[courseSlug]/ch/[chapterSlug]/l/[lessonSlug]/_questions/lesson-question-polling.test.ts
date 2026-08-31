import { describe, expect, it } from "vitest";
import {
  getLessonQuestionPollDelay,
  hasLessonQuestionPollingBudget,
} from "./lesson-question-polling";

describe(getLessonQuestionPollDelay, () => {
  it("backs off with bounded jitter", () => {
    expect(getLessonQuestionPollDelay({ attempt: 0, elapsedMilliseconds: 0, random: 0 })).toBe(800);

    expect(getLessonQuestionPollDelay({ attempt: 0, elapsedMilliseconds: 0, random: 1 })).toBe(
      1200,
    );

    expect(getLessonQuestionPollDelay({ attempt: 3, elapsedMilliseconds: 10_000, random: 0 })).toBe(
      4000,
    );

    expect(getLessonQuestionPollDelay({ attempt: 3, elapsedMilliseconds: 10_000, random: 1 })).toBe(
      6000,
    );
  });

  it("stops after the attempt or time budget is exhausted", () => {
    expect(
      getLessonQuestionPollDelay({ attempt: 8, elapsedMilliseconds: 0, random: 0.5 }),
    ).toBeNull();

    expect(
      getLessonQuestionPollDelay({ attempt: 0, elapsedMilliseconds: 60_000, random: 0.5 }),
    ).toBeNull();
  });
});

describe(hasLessonQuestionPollingBudget, () => {
  it("expires while polling is paused", () => {
    expect(hasLessonQuestionPollingBudget({ attempt: 0, elapsedMilliseconds: 59_999 })).toBe(true);
    expect(hasLessonQuestionPollingBudget({ attempt: 0, elapsedMilliseconds: 60_000 })).toBe(false);
  });
});
