import { type LatencyBudget } from "./types";

const MS_TO_SECONDS = 1000;

/**
 * Nearest-rank percentile: always a latency that was actually measured, which
 * keeps p95 honest on the small case counts evals use.
 */
function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const rank = Math.ceil((percentile / 100) * sortedValues.length);
  return sortedValues[Math.max(0, rank - 1)] ?? 0;
}

/**
 * Summarizes call durations as the median and the slow tail learners notice.
 * Averages hide the tail, and a classifier on the answer path waits on it.
 */
export function summarizeLatency(durationsMs: number[]): { p50: number; p95: number } {
  const sorted = durationsMs.toSorted((a, b) => a - b);

  return {
    p50: getPercentile(sorted, 50) / MS_TO_SECONDS,
    p95: getPercentile(sorted, 95) / MS_TO_SECONDS,
  };
}

/**
 * Whether a model's measured latency fits the task's budget: both the median
 * and the slow tail must, since a fast median can hide waits learners notice.
 * Null when the task has no budget, as for work made ahead of time.
 */
export function meetsLatencyBudget({
  budget,
  latency,
}: {
  budget?: LatencyBudget;
  latency: { p50: number; p95: number };
}): boolean | null {
  if (!budget) {
    return null;
  }

  return latency.p50 <= budget.p50 && latency.p95 <= budget.p95;
}
