const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
const READING_PAGES_PER_HOUR = 40;
const REFERENCE_BOOK_PAGES = 300;
const MINIMUM_BOOK_COMPARISON_HOURS = 9;

export type LearningTimeReadingComparison =
  | { kind: "pages"; pages: number }
  | { books: number; kind: "books"; pagesPerBook: number };

/**
 * Makes accumulated learning time easier to picture with a simple book
 * comparison. Early milestones stay in pages, while nine hours and beyond use
 * a familiar 300-page book so large totals remain easy to understand.
 */
export function getLearningTimeReadingComparison(seconds: number): LearningTimeReadingComparison {
  const hours = seconds / SECONDS_PER_HOUR;
  const pages = Math.round(hours * READING_PAGES_PER_HOUR);

  if (hours < MINIMUM_BOOK_COMPARISON_HOURS) {
    return { kind: "pages", pages };
  }

  const books = Math.round(pages / REFERENCE_BOOK_PAGES);

  return { books, kind: "books", pagesPerBook: REFERENCE_BOOK_PAGES };
}
