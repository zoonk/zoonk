import { createDeterministicStringFieldScorer } from "@/lib/deterministic-string-field-scorer";

export type LessonTranslationExpected = { accepted: readonly [string, ...string[]] };

const SURROUNDING_PUNCTUATION = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
  ["«", "»"],
  ["(", ")"],
] as const;

/** Removes one balanced presentation wrapper without touching internal punctuation. */
function stripSurroundingPunctuation(value: string): string {
  const pair = SURROUNDING_PUNCTUATION.find(
    ([opening, closing]) => value.startsWith(opening) && value.endsWith(closing),
  );

  return pair ? value.slice(pair[0].length, -pair[1].length).trim() : value;
}

/** Removes sentence punctuation that does not change a word-level translation. */
function stripTerminalPunctuation(value: string): string {
  return value.replace(/[.!?。！？]+$/u, "").trim();
}

/**
 * Normalizes presentation-only differences while preserving meaning-bearing
 * accents, articles, punctuation, and word boundaries. Translation is a
 * closed-set eval, so semantic similarity is never inferred by the scorer.
 */
function normalizeTranslation(value: string): string {
  const normalizedWhitespace = value.normalize("NFC").trim().replaceAll(/\s+/gu, " ");
  const withoutOuterTerminalPunctuation = stripTerminalPunctuation(normalizedWhitespace);

  const withoutSurroundingPunctuation = stripSurroundingPunctuation(
    withoutOuterTerminalPunctuation,
  );

  return stripTerminalPunctuation(withoutSurroundingPunctuation).toLowerCase();
}

/**
 * Rejects invalid gold data before scoring. An empty or duplicate accepted
 * value is a fixture error, not a model mistake that should receive a six.
 */
function getAcceptedTranslations(
  expected: LessonTranslationExpected | undefined,
): readonly string[] {
  const accepted = expected?.accepted;

  if (
    !accepted ||
    accepted.length === 0 ||
    !accepted.every(
      (translation) =>
        typeof translation === "string" && normalizeTranslation(translation).length > 0,
    )
  ) {
    throw new Error("Lesson-translation test cases require accepted translations.");
  }

  const normalized = accepted.map((translation) => normalizeTranslation(translation));

  if (new Set(normalized).size !== normalized.length) {
    throw new Error("Lesson-translation test cases contain duplicate normalized translations.");
  }

  return accepted;
}

/**
 * Scores one scalar translation against explicit accepted dictionary forms.
 * A complete match earns ten; wrong, malformed, or contract-breaking output
 * earns six because there is no smaller independently correct sub-result.
 */
export const scoreLessonTranslation =
  createDeterministicStringFieldScorer<LessonTranslationExpected>({
    expectedLabel: "Expected translation",
    field: "translation",
    generatedLabel: "Generated translation",
    getAcceptedValues: getAcceptedTranslations,
    normalizeValue: normalizeTranslation,
  });
