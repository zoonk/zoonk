import { describe, expect, it } from "vitest";
import { getLessonQuestionLimitRetryAt } from "./lesson-question-limit";

describe(getLessonQuestionLimitRetryAt, () => {
  it("uses the next UTC day for a daily limit", () => {
    expect(
      getLessonQuestionLimitRetryAt({ now: new Date("2026-08-21T23:59:50.000Z"), period: "day" }),
    ).toBe("2026-08-22T00:00:00.000Z");
  });

  it("uses the first UTC day of the next month for a monthly limit", () => {
    expect(
      getLessonQuestionLimitRetryAt({ now: new Date("2026-12-31T23:59:50.000Z"), period: "month" }),
    ).toBe("2027-01-01T00:00:00.000Z");
  });
});
