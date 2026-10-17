import { type ClassificationOutcome } from "./types";

/** Shown for outputs that had no valid label, so failures stay visible in the matrix. */
const NO_LABEL = "(none)";

type LabelAccuracy = { label: string; correct: number; total: number; accuracy: number };

export type ClassificationSummary = {
  accuracy: number;
  total: number;
  perLabel: LabelAccuracy[];
  /** Every label seen as expected or predicted, in a stable order for the matrix axes. */
  labels: string[];
  /** counts[expected][predicted] */
  counts: Record<string, Record<string, number>>;
};

function getPredictedLabel(outcome: ClassificationOutcome): string {
  return outcome.predicted ?? NO_LABEL;
}

function getLabelAccuracy({
  label,
  outcomes,
}: {
  label: string;
  outcomes: ClassificationOutcome[];
}): LabelAccuracy {
  const cases = outcomes.filter((outcome) => outcome.expected === label);
  const correct = cases.filter((outcome) => outcome.predicted === label).length;

  return {
    accuracy: cases.length > 0 ? correct / cases.length : 0,
    correct,
    label,
    total: cases.length,
  };
}

function countPredictions({
  label,
  outcomes,
}: {
  label: string;
  outcomes: ClassificationOutcome[];
}): Record<string, number> {
  const predictions = outcomes
    .filter((outcome) => outcome.expected === label)
    .map((outcome) => getPredictedLabel(outcome));

  return Object.fromEntries(
    [...new Set(predictions)].map((predicted) => [
      predicted,
      predictions.filter((item) => item === predicted).length,
    ]),
  );
}

/**
 * Per-label accuracy (recall) and a confusion matrix. An average can look fine
 * while a rare label, like `unsafe` or `tutorial`, is almost always wrong.
 */
export function summarizeClassification(
  outcomes: ClassificationOutcome[],
): ClassificationSummary | null {
  if (outcomes.length === 0) {
    return null;
  }

  const expectedLabels = [...new Set(outcomes.map((outcome) => outcome.expected))].toSorted();

  const extraLabels = [...new Set(outcomes.map((outcome) => getPredictedLabel(outcome)))]
    .filter((label) => !expectedLabels.includes(label))
    .toSorted();

  const correct = outcomes.filter((outcome) => outcome.predicted === outcome.expected).length;

  return {
    accuracy: correct / outcomes.length,
    counts: Object.fromEntries(
      expectedLabels.map((label) => [label, countPredictions({ label, outcomes })]),
    ),
    labels: [...expectedLabels, ...extraLabels],
    perLabel: expectedLabels.map((label) => getLabelAccuracy({ label, outcomes })),
    total: outcomes.length,
  };
}
