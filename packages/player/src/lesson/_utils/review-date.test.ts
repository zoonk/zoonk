import { describe, expect, it } from "vitest";
import { describeReviewDate } from "./review-date";

const NOW = new Date(2026, 8, 30, 21, 0);

function at(daysAhead: number, hour = 9): string {
  return new Date(2026, 8, 30 + daysAhead, hour, 0).toISOString();
}

describe(describeReviewDate, () => {
  it("names today and tomorrow by the calendar day, not 24-hour spans", () => {
    expect(describeReviewDate({ locale: "en", now: NOW, reviewAt: at(0, 23) })).toStrictEqual({
      kind: "today",
    });

    expect(describeReviewDate({ locale: "en", now: NOW, reviewAt: at(1, 1) })).toStrictEqual({
      kind: "tomorrow",
    });
  });

  it("names the weekday within a week and the date after that, in the learner's language", () => {
    expect(describeReviewDate({ locale: "en", now: NOW, reviewAt: at(3) })).toStrictEqual({
      kind: "weekday",
      label: "Saturday",
    });

    expect(describeReviewDate({ locale: "pt", now: NOW, reviewAt: at(3) })).toStrictEqual({
      kind: "weekday",
      label: "sábado",
    });

    expect(describeReviewDate({ locale: "en", now: NOW, reviewAt: at(14) })).toStrictEqual({
      kind: "date",
      label: "Oct 14",
    });
  });

  it("treats an overdue review as today", () => {
    expect(describeReviewDate({ locale: "en", now: NOW, reviewAt: at(-2) })).toStrictEqual({
      kind: "today",
    });
  });
});
