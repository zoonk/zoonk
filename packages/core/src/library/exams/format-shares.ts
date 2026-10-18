import {
  type FormatCount,
  type QuestionFormat,
} from "@zoonk/ai/tasks/v2/research/extract-question-formats";

const PERCENT = 100;

/** The formats a share of the exam's objective questions is counted over: picked, numbers, words. */
const SHARED_KINDS: ReadonlySet<QuestionFormat["kind"]> = new Set([
  "multipleChoice",
  "trueFalse",
  "shortAnswer",
  "numeric",
]);

type CountedFormat = { count: FormatCount | null; kind: QuestionFormat["kind"] };

/** Whether questions of this format make up an objective test: picked, typed as numbers or words. */
export function isObjectiveFormat(kind: QuestionFormat["kind"]): boolean {
  return SHARED_KINDS.has(kind);
}

function isSameMeasure(count: FormatCount, other: FormatCount): boolean {
  return count.per === other.per && count.unit === other.unit;
}

/**
 * Each format's share of the exam's objective questions, from 0 to 1, worked out from the counts
 * the notice states for them (`count`), in the formats' order: a number of questions out of every
 * objective format's, or a percent of the questions. It needs a count for every objective format,
 * all over the same part and in the same unit, since a format without one could take any share
 * of the rest; otherwise no format has a share. Written, oral and practical formats never have one.
 */
export function getFormatShares(formats: readonly CountedFormat[]): (number | null)[] {
  const objective = formats.filter((format) => isObjectiveFormat(format.kind));
  const [first] = objective;

  const counts = objective.flatMap(({ count }) =>
    count && count.value > 0 && first?.count && isSameMeasure(count, first.count) ? [count] : [],
  );

  if (!first?.count || counts.length < objective.length) {
    return formats.map(() => null);
  }

  const sum = counts.reduce((total, count) => total + count.value, 0);
  const whole = first.count.unit === "percent" ? Math.max(PERCENT, sum) : sum;

  return formats.map(({ count, kind }) =>
    count && isObjectiveFormat(kind) ? count.value / whole : null,
  );
}
