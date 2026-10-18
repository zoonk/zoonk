import { createFixedScore } from "@/lib/score";
import { type ClassificationOutcome, type TaskScorer } from "@/lib/types";
import { getString, isJsonObject } from "@zoonk/utils/json";

type StringFieldScorerConfig<TExpected> = {
  field: string;
  expectedLabel: string;
  generatedLabel: string;
  getAcceptedValues: (expected: TExpected | undefined) => readonly string[];
  acceptedValuesSeparator?: string;
  forbiddenGeneratedLabel?: string;
  getForbiddenValues?: (expected: TExpected | undefined) => readonly string[];
  missingValueMessage?: string;
  normalizeValue?: (value: string) => string;
  /**
   * Fields the task's schema returns next to the scored one, such as a title that later code
   * reads. They aren't extras; any other field still fails the case.
   */
  otherOutputFields?: readonly string[];
  /**
   * Classifiers pick from a fixed label set, so their results can report
   * per-label accuracy and a confusion matrix. Free-text fields such as
   * titles or translations leave this off.
   */
  reportsLabels?: boolean;
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
 * Formats accepted values exactly the way deterministic scorer conclusions show
 * them. Centralizing this prevents small wording drift between task-specific
 * scorers when they all share the same pass/fail rule.
 */
function getQuotedValueList({
  fallback,
  separator,
  values,
}: {
  fallback: string;
  separator: string;
  values: readonly string[];
}): string {
  if (values.length === 0) {
    return fallback;
  }

  return values.map((value) => `\`${value}\``).join(separator);
}

/**
 * Creates the first details sentence for failed deterministic scores. The label
 * stays task-specific, while accepted-value formatting stays shared.
 */
function getExpectedValuesMessage({
  expectedLabel,
  separator,
  values,
}: {
  expectedLabel: string;
  separator: string;
  values: readonly string[];
}): string {
  return `${expectedLabel} ${getQuotedValueList({
    fallback: "from the test case",
    separator,
    values,
  })}.`;
}

/**
 * Some cases accept several labels. The confusion matrix needs one expected
 * label per case: the accepted label the model chose, or the first accepted one.
 */
function getClassificationOutcome({
  accepted,
  acceptedValues,
  normalizedValue,
  value,
}: {
  accepted: string[];
  acceptedValues: readonly string[];
  normalizedValue: string | null;
  value: string | null;
}): ClassificationOutcome {
  const matchIndex = normalizedValue === null ? -1 : accepted.indexOf(normalizedValue);
  const expected = acceptedValues[matchIndex] ?? acceptedValues[0] ?? "unknown";

  return { expected, predicted: matchIndex === -1 ? value : expected };
}

/**
 * Builds deterministic scorers for tasks whose output is one JSON string field.
 * The task supplies its accepted values and wording; this helper owns parsing,
 * normalization, extra-field rejection, and the fixed 10-or-6 score contract.
 */
export function createDeterministicStringFieldScorer<TExpected>({
  acceptedValuesSeparator = " or ",
  expectedLabel,
  field,
  forbiddenGeneratedLabel,
  generatedLabel,
  getAcceptedValues,
  getForbiddenValues,
  missingValueMessage = `Generated output did not include a string ${field}.`,
  normalizeValue = (value) => value,
  otherOutputFields = [],
  reportsLabels = false,
}: StringFieldScorerConfig<TExpected>): TaskScorer<TExpected> {
  return ({ output, testCase }) => {
    const { extraKeys, value } = getGeneratedStringField({ field, otherOutputFields, output });
    const acceptedValues = getAcceptedValues(testCase.expected);
    const forbiddenValues = getForbiddenValues?.(testCase.expected) ?? [];
    const normalizedValue = value ? normalizeValue(value) : null;
    const accepted = acceptedValues.map((acceptedValue) => normalizeValue(acceptedValue));
    const forbidden = forbiddenValues.map((forbiddenValue) => normalizeValue(forbiddenValue));

    const classification = reportsLabels
      ? getClassificationOutcome({ accepted, acceptedValues, normalizedValue, value })
      : undefined;

    if (normalizedValue && accepted.includes(normalizedValue) && extraKeys.length === 0) {
      return { ...createFixedScore({ conclusion: "None", score: 10 }), classification };
    }

    const matchedForbiddenValue =
      normalizedValue && forbidden.includes(normalizedValue) ? value : null;

    const details = [
      getExpectedValuesMessage({
        expectedLabel,
        separator: acceptedValuesSeparator,
        values: acceptedValues,
      }),
      value ? `${generatedLabel} \`${value}\`.` : missingValueMessage,
      matchedForbiddenValue && forbiddenGeneratedLabel
        ? `${forbiddenGeneratedLabel} \`${matchedForbiddenValue}\`.`
        : null,
      extraKeys.length > 0 ? `Generated extra fields: ${extraKeys.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ");

    return { ...createFixedScore({ conclusion: details, score: 6 }), classification };
  };
}
