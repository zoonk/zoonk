import { describe, expect, it } from "vitest";
import { getLearningTimeReadingComparison } from "./learning-time-reading-comparison";

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

describe(getLearningTimeReadingComparison, () => {
  it("uses pages for early learning-time milestones", () => {
    expect(getLearningTimeReadingComparison(10 * SECONDS_PER_MINUTE)).toStrictEqual({
      kind: "pages",
      pages: 7,
    });
  });

  it("turns nine learning hours into one 300-page book", () => {
    expect(getLearningTimeReadingComparison(9 * SECONDS_PER_HOUR)).toStrictEqual({
      books: 1,
      kind: "books",
      pagesPerBook: 300,
    });
  });

  it("keeps larger comparisons easy to picture", () => {
    expect(getLearningTimeReadingComparison(24 * SECONDS_PER_HOUR)).toStrictEqual({
      books: 3,
      kind: "books",
      pagesPerBook: 300,
    });
  });
});
