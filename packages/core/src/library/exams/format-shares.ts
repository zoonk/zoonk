import {
  type FormatCount,
  type QuestionFormat,
} from "@zoonk/ai/tasks/v2/research/extract-question-formats";

const PERCENT = 100;

const SHARED_KINDS: ReadonlySet<QuestionFormat["kind"]> = new Set([
  "multipleChoice",
  "trueFalse",
  "shortAnswer",
  "numeric",
]);

type CountedFormat = { count: FormatCount | null; kind: QuestionFormat["kind"] };

export function isObjectiveFormat(kind: QuestionFormat["kind"]): boolean {
  return SHARED_KINDS.has(kind);
}

function isSameMeasure(count: FormatCount, other: FormatCount): boolean {
  return count.per === other.per && count.unit === other.unit;
}

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
