import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { type AICourseCategory, isAICourseCategory } from "@zoonk/utils/categories";
import { isJsonObject } from "@zoonk/utils/json";

export type CourseCategoriesExpected = { categories: readonly AICourseCategory[] };

type GeneratedCategories = { categories: AICourseCategory[] | null; extraKeys: string[] };

/**
 * Reads a valid, non-empty model category set from an artifact. Eval artifacts
 * can be malformed or edited independently of the production schema, so this
 * parser validates the same taxonomy and never coerces invalid values.
 */
function getGeneratedCategories(output: string): GeneratedCategories {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { categories: null, extraKeys: [] };
    }

    const categories = parsed.categories;

    const validCategories =
      Array.isArray(categories) &&
      categories.length > 0 &&
      categories.every((category) => isAICourseCategory(category))
        ? [...new Set(categories)]
        : null;

    const extraKeys = Object.keys(parsed).filter((key) => key !== "categories");

    return { categories: validCategories, extraKeys };
  } catch {
    return { categories: null, extraKeys: [] };
  }
}

/**
 * Rejects invalid fixture data before scoring. A malformed expected value is a
 * configuration error in the eval, not a model mistake that should earn a six.
 */
function getExpectedCategories(
  expected: CourseCategoriesExpected | undefined,
): readonly AICourseCategory[] {
  const categories = expected?.categories;
  const hasDuplicates = categories && new Set(categories).size !== categories.length;

  if (
    !categories ||
    categories.length === 0 ||
    !categories.every((category) => isAICourseCategory(category)) ||
    hasDuplicates
  ) {
    throw new Error("Course-category test cases require a non-empty, unique AI category set.");
  }

  return categories;
}

/**
 * Maps Jaccard set similarity onto the eval's 6–10 scale. This gives balanced
 * partial credit for missing and unexpected categories while preserving ten
 * exclusively for an exact set match.
 */
function getCategoryScore({
  expected,
  generated,
}: {
  expected: readonly AICourseCategory[];
  generated: readonly AICourseCategory[];
}): number {
  const expectedSet = new Set(expected);
  const generatedSet = new Set(generated);
  const matchingCount = expected.filter((category) => generatedSet.has(category)).length;
  const unionCount = new Set([...expectedSet, ...generatedSet]).size;

  return Math.round((6 + 4 * (matchingCount / unionCount)) * 100) / 100;
}

/** Formats category sets so deterministic conclusions are easy to compare. */
function getCategorySetLabel(categories: readonly string[]): string {
  return categories.map((category) => `\`${category}\``).join(", ");
}

/**
 * Explains partial matches in terms of their missing and unexpected members so
 * a score immediately identifies what the model needs to correct.
 */
function getMismatchConclusion({
  expected,
  generated,
}: {
  expected: readonly AICourseCategory[];
  generated: readonly AICourseCategory[];
}): string {
  const expectedSet = new Set(expected);
  const generatedSet = new Set(generated);
  const missing = expected.filter((category) => !generatedSet.has(category));
  const unexpected = generated.filter((category) => !expectedSet.has(category));

  return [
    `Expected categories ${getCategorySetLabel(expected)}.`,
    `Generated categories ${getCategorySetLabel(generated)}.`,
    missing.length > 0 ? `Missing ${getCategorySetLabel(missing)}.` : null,
    unexpected.length > 0 ? `Unexpected ${getCategorySetLabel(unexpected)}.` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Scores valid category sets proportionally and reserves the deterministic
 * minimum for malformed output or fields outside the production contract.
 */
export const scoreCourseCategories: TaskScorer<CourseCategoriesExpected> = ({
  output,
  testCase,
}) => {
  const expected = getExpectedCategories(testCase.expected);
  const generated = getGeneratedCategories(output);

  if (!generated.categories) {
    return createFixedScore({
      conclusion: `Expected categories ${getCategorySetLabel(expected)}. Generated output did not include a valid, non-empty AI categories array.`,
      score: 6,
    });
  }

  if (generated.extraKeys.length > 0) {
    return createFixedScore({
      conclusion: `${getMismatchConclusion({ expected, generated: generated.categories })} Generated extra fields: ${generated.extraKeys.join(", ")}.`,
      score: 6,
    });
  }

  const score = getCategoryScore({ expected, generated: generated.categories });

  const conclusion =
    score === 10 ? "None" : getMismatchConclusion({ expected, generated: generated.categories });

  return createFixedScore({ conclusion, score });
};
