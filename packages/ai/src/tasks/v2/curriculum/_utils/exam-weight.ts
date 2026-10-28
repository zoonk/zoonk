/** 1 is a prerequisite the exam doesn't test directly; 5 is a large share of its points. */
const MIN_EXAM_WEIGHT = 1;
const MAX_EXAM_WEIGHT = 5;

export function toExamWeight(value: number | null): number | null {
  return value === null
    ? null
    : Math.min(MAX_EXAM_WEIGHT, Math.max(MIN_EXAM_WEIGHT, Math.round(value)));
}
