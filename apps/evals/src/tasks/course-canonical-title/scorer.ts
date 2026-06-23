import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";

export type CourseCanonicalTitleExpected = {
  acceptedTitles: readonly string[];
  forbiddenTitles?: readonly string[];
};

/**
 * Normalizes titles for deterministic equality without making semantic guesses.
 * This accepts harmless casing, whitespace, and trailing sentence punctuation
 * differences while still rejecting level markers or unsafe title variants.
 */
function normalizeTitle(title: string): string {
  return title
    .trim()
    .replaceAll(/\s+/gu, " ")
    .replace(/[.?!]+$/u, "")
    .toLowerCase();
}

/**
 * Scores canonical titles deterministically. A run receives 10 only when the
 * generated title matches an explicitly accepted title and has no extra fields;
 * all other outputs receive 6 with the same score in every score bucket.
 */
export const scoreCourseCanonicalTitle =
  createDeterministicStringFieldScorer<CourseCanonicalTitleExpected>({
    acceptedValuesSeparator: ", ",
    expectedLabel: "Expected one of:",
    field: "title",
    forbiddenGeneratedLabel: "Generated forbidden title",
    generatedLabel: "Generated title",
    getAcceptedValues: (expected) => expected?.acceptedTitles ?? [],
    getForbiddenValues: (expected) => expected?.forbiddenTitles ?? [],
    normalizeValue: normalizeTitle,
  });
