import { createFixedScore } from "@/lib/score";
import { type ClassificationOutcome, type TaskScorer } from "@/lib/types";
import { getString, isJsonObject } from "@zoonk/utils/json";

type StringFieldScorerConfig<TExpected> = {
  field: string;
  expectedLabel: string;
  generatedLabel: string;
  getAcceptedValues: (expected: TExpected | undefined) => readonly string[];
  /**
   * Fields the task's schema returns next to the scored one, such as a title that later code
   * reads. They aren't extras; any other field still fails the case.
   */
  otherOutputFields?: readonly string[];
};

/**
 * Reads one string field from model JSON output and reports extra keys. Several
 * eval tasks use structured object output with a single meaningful field, so a
 * shared parser keeps missing-field and extra-field handling consistent.
 */
function getGeneratedStringField({
  field,
  otherOutputFields,
  output,
}: {
  field: string;
  otherOutputFields: readonly string[];
  output: string;
}): { extraKeys: string[]; value: string | null } {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { extraKeys: [], value: null };
    }

    const value = getString(parsed, field);

    const extraKeys = Object.keys(parsed).filter(
      (key) => key !== field && !otherOutputFields.includes(key),
    );

    return { extraKeys, value };
  } catch {
    return { extraKeys: [], value: null };
  }
}

/**
 * Some cases accept several labels. The confusion matrix needs one expected
 * label per case: the accepted label the model chose, or the first accepted one.
 */
function getClassificationOutcome({
  acceptedValues,
  value,
}: {
  acceptedValues: readonly string[];
  value: string | null;
}): ClassificationOutcome {
  const matchIndex = value === null ? -1 : acceptedValues.indexOf(value);
  const expected = acceptedValues[matchIndex] ?? acceptedValues[0] ?? "unknown";

  return { expected, predicted: matchIndex === -1 ? value : expected };
}

/**
 * Builds deterministic scorers for tasks whose output is one JSON string field.
 * The task supplies its accepted values and wording; this helper owns parsing,
 * extra-field rejection and the fixed 10-or-6 score contract.
 */
export function createDeterministicStringFieldScorer<TExpected>({
  expectedLabel,
  field,
  generatedLabel,
  getAcceptedValues,
  otherOutputFields = [],
}: StringFieldScorerConfig<TExpected>): TaskScorer<TExpected> {
  return ({ output, testCase }) => {
    const { extraKeys, value } = getGeneratedStringField({ field, otherOutputFields, output });
    const acceptedValues = getAcceptedValues(testCase.expected);
    const classification = getClassificationOutcome({ acceptedValues, value });

    if (value && acceptedValues.includes(value) && extraKeys.length === 0) {
      return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
    }

    const expectedValues = acceptedValues
      .map((acceptedValue) => `\`${acceptedValue}\``)
      .join(" or ");

    const details = [
      `${expectedLabel} ${expectedValues || "from the test case"}.`,
      value
        ? `${generatedLabel} \`${value}\`.`
        : `Generated output did not include a string ${field}.`,
      extraKeys.length > 0 ? `Generated extra fields: ${extraKeys.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return { ...createFixedScore({ conclusion: details, score: 6 }), classification };
  };
}
