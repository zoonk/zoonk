import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

export type CoursePersonalizationExpected = { requiresPersonalization: boolean };

/**
 * Reads the single boolean field from personalization outputs. This task cannot
 * reuse the string-field scorer because booleans must stay booleans; accepting
 * "true" as a string would hide schema or export regressions.
 */
function getGeneratedPersonalization(output: string): {
  extraKeys: string[];
  value: boolean | null;
} {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { extraKeys: [], value: null };
    }

    const value = parsed.requiresPersonalization;
    const extraKeys = Object.keys(parsed).filter((key) => key !== "requiresPersonalization");

    return { extraKeys, value: typeof value === "boolean" ? value : null };
  } catch {
    return { extraKeys: [], value: null };
  }
}

/**
 * Scores personalization classification deterministically. A run receives 10
 * only when the boolean matches and no extra keys are present; all other
 * outputs receive 6 so model-judge noise cannot change task scores.
 */
export const scoreCoursePersonalization: TaskScorer<CoursePersonalizationExpected> = ({
  output,
  testCase,
}) => {
  const { extraKeys, value } = getGeneratedPersonalization(output);
  const expected = testCase.expected?.requiresPersonalization;

  if (value === expected && extraKeys.length === 0) {
    return createFixedScore({ conclusion: "None", score: 10 });
  }

  const details = [
    `Expected requiresPersonalization \`${String(expected)}\`.`,
    value === null
      ? "Generated output did not include a boolean requiresPersonalization."
      : `Generated requiresPersonalization \`${String(value)}\`.`,
    extraKeys.length > 0 ? `Generated extra fields: ${extraKeys.join(", ")}.` : null,
  ].filter(Boolean);

  return createFixedScore({ conclusion: details.join(" "), score: 6 });
};
