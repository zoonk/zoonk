import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

export type RomanizationExpectation = { accepted: readonly [string, ...string[]] };

export type LessonRomanizationExpected = { romanizations: readonly RomanizationExpectation[] };

type GeneratedRomanizations = { extraKeys: string[]; romanizations: string[] | null };

const PUNCTUATION_REPLACEMENTS: Readonly<Record<string, string>> = {
  "،": ",",
  "؛": ";",
  "؟": "?",
  "、": ",",
  "。": ".",
  "！": "!",
  "，": ",",
  "．": ".",
  "：": ":",
  "；": ";",
  "？": "?",
};

const SOURCE_PUNCTUATION_PATTERN = /[،؛؟、。！，．：；？]/gu;
const LATIN_LETTER_PATTERN = /(?=\p{L})\p{Script=Latin}/u;

const ROMANIZATION_PATTERN =
  /^(?:(?=\p{L})\p{Script=Latin}(?:(?=\p{M})\p{Script_Extensions=Latin})*|[ \p{P}]|[ʻʼʹʺʾʿ])+$/u;

/** Preserves unknown element types when validating arrays from parsed data. */
function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Normalizes presentation-only differences without erasing linguistic
 * information. Diacritics, internal punctuation, and word boundaries remain
 * significant because they encode pronunciation and the required system.
 */
function normalizeRomanization(value: string): string {
  const romanPunctuation = value
    .normalize("NFC")
    .replaceAll(
      SOURCE_PUNCTUATION_PATTERN,
      (character) => PUNCTUATION_REPLACEMENTS[character] ?? character,
    );

  return romanPunctuation
    .trim()
    .replaceAll(/\s+/gu, " ")
    .toLowerCase()
    .replace(/[.!?]+$/u, "")
    .trim();
}

/**
 * Accepts Latin-script romanization with standard modifier letters and
 * punctuation while rejecting copied source scripts, digits, emoji, and
 * standalone marks.
 */
function isValidRomanization(value: string): boolean {
  const normalized = normalizeRomanization(value);

  return LATIN_LETTER_PATTERN.test(normalized) && ROMANIZATION_PATTERN.test(normalized);
}

/**
 * Reads the generated array without coercion. Production schema validation is
 * strict, but saved eval artifacts can be malformed or edited independently.
 */
function getGeneratedRomanizations(output: string): GeneratedRomanizations {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { extraKeys: [], romanizations: null };
    }

    const romanizations = parsed.romanizations;

    const validRomanizations =
      isUnknownArray(romanizations) &&
      romanizations.every(
        (romanization): romanization is string =>
          typeof romanization === "string" && romanization.trim().length > 0,
      )
        ? romanizations
        : null;

    const extraKeys = Object.keys(parsed).filter((key) => key !== "romanizations");

    return { extraKeys, romanizations: validRomanizations };
  } catch {
    return { extraKeys: [], romanizations: null };
  }
}

/**
 * Gets the requested item count from the paired input so fixture drift throws
 * as an eval configuration error instead of lowering a model's score.
 */
function getInputTextCount(userInput: Record<string, unknown>): number {
  const texts = userInput.texts;

  if (
    !isUnknownArray(texts) ||
    texts.length === 0 ||
    !texts.every((text) => typeof text === "string" && text.trim().length > 0)
  ) {
    throw new Error("Lesson-romanization test cases require non-empty input texts.");
  }

  return texts.length;
}

/**
 * Validates one accepted set before scoring and returns its typed value.
 * Duplicate normalized variants add no coverage and usually reveal aliases
 * that belong in the normalizer instead.
 */
function getValidatedExpectation({
  expectation,
  index,
}: {
  expectation: unknown;
  index: number;
}): RomanizationExpectation {
  if (!isJsonObject(expectation) || !isUnknownArray(expectation.accepted)) {
    throw new Error(
      `Lesson-romanization expectation ${index + 1} requires accepted romanizations.`,
    );
  }

  const [firstAccepted, ...remainingAccepted] = expectation.accepted;

  if (
    typeof firstAccepted !== "string" ||
    !isValidRomanization(firstAccepted) ||
    !remainingAccepted.every(
      (accepted): accepted is string =>
        typeof accepted === "string" && isValidRomanization(accepted),
    )
  ) {
    throw new Error(
      `Lesson-romanization expectation ${index + 1} requires valid accepted romanizations.`,
    );
  }

  const accepted: [string, ...string[]] = [firstAccepted, ...remainingAccepted];
  const normalized = accepted.map((romanization) => normalizeRomanization(romanization));

  if (new Set(normalized).size !== normalized.length) {
    throw new Error(
      `Lesson-romanization expectation ${index + 1} contains duplicate normalized variants.`,
    );
  }

  return { accepted };
}

/**
 * Validates all structured gold values and their alignment with input texts.
 * Invalid gold data must fail the eval rather than be reported as model error.
 */
function getExpectedRomanizations({
  expected,
  textCount,
}: {
  expected: unknown;
  textCount: number;
}): readonly RomanizationExpectation[] {
  if (
    !isJsonObject(expected) ||
    !isUnknownArray(expected.romanizations) ||
    expected.romanizations.length !== textCount
  ) {
    throw new Error(
      "Lesson-romanization expected values must align one-to-one with the input texts.",
    );
  }

  return expected.romanizations.map((expectation, index) =>
    getValidatedExpectation({ expectation, index }),
  );
}

/** Checks one generated item against the explicitly accepted variants. */
function matchesExpectation({
  expectation,
  generated,
}: {
  expectation: RomanizationExpectation;
  generated: string;
}): boolean {
  const normalizedGenerated = normalizeRomanization(generated);

  return expectation.accepted.some(
    (accepted) => normalizeRomanization(accepted) === normalizedGenerated,
  );
}

/** Formats accepted variants for deterministic mismatch conclusions. */
function getAcceptedLabel(expectation: RomanizationExpectation): string {
  return expectation.accepted.map((accepted) => `\`${accepted}\``).join(" or ");
}

/**
 * Describes one mismatched index while leaving matching indexes out of the
 * conclusion so model comparisons stay concise.
 */
function getMismatchDetail({
  expectation,
  generated,
  index,
}: {
  expectation: RomanizationExpectation;
  generated: string;
  index: number;
}): string | null {
  if (matchesExpectation({ expectation, generated })) {
    return null;
  }

  return `Index ${index + 1} expected ${getAcceptedLabel(expectation)}; generated \`${generated}\`.`;
}

/** Maps the share of correct indexes onto the eval's deterministic 6–10 scale. */
function getRomanizationScore({
  matchingCount,
  totalCount,
}: {
  matchingCount: number;
  totalCount: number;
}): number {
  return Math.round((6 + 4 * (matchingCount / totalCount)) * 100) / 100;
}

/**
 * Scores romanization per input index. Exact accepted forms earn ten, valid
 * Latin mismatches receive proportional credit, and global contract failures
 * receive the deterministic minimum.
 */
export const scoreLessonRomanization: TaskScorer<LessonRomanizationExpected> = ({
  output,
  testCase,
}) => {
  const textCount = getInputTextCount(testCase.userInput);
  const expected = getExpectedRomanizations({ expected: testCase.expected, textCount });
  const generated = getGeneratedRomanizations(output);

  if (!generated.romanizations) {
    return createFixedScore({
      conclusion: "Generated output did not include a non-empty string romanizations array.",
      score: 6,
    });
  }

  const romanizations = generated.romanizations;

  if (generated.extraKeys.length > 0) {
    return createFixedScore({
      conclusion: `Generated extra fields: ${generated.extraKeys.join(", ")}.`,
      score: 6,
    });
  }

  if (romanizations.length !== textCount) {
    return createFixedScore({
      conclusion: `Expected ${textCount} romanizations; generated ${romanizations.length}.`,
      score: 6,
    });
  }

  const invalidIndex = romanizations.findIndex(
    (romanization) => !isValidRomanization(romanization),
  );

  if (invalidIndex !== -1) {
    return createFixedScore({
      conclusion: `Generated romanization at index ${invalidIndex + 1} contained characters outside the Romanization contract.`,
      score: 6,
    });
  }

  const matchingCount = expected.filter((expectation, index) =>
    matchesExpectation({ expectation, generated: romanizations[index] ?? "" }),
  ).length;

  const score = getRomanizationScore({ matchingCount, totalCount: textCount });

  if (score === 10) {
    return createFixedScore({ conclusion: "None", score });
  }

  const mismatchDetails = expected
    .map((expectation, index) =>
      getMismatchDetail({ expectation, generated: romanizations[index] ?? "", index }),
    )
    .filter(Boolean);

  return createFixedScore({
    conclusion: `Matched ${matchingCount} of ${textCount} romanizations in input order. ${mismatchDetails.join(" ")}`,
    score,
  });
};
