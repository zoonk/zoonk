import { type LatencyBudget } from "./types";

const MS_TO_SECONDS = 1000;

function getPercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const rank = Math.ceil((percentile / 100) * sortedValues.length);
  return sortedValues[Math.max(0, rank - 1)] ?? 0;
}

export function summarizeLatency(durationsMs: number[]): { p50: number; p95: number } {
  const sorted = durationsMs.toSorted((a, b) => a - b);

  return {
    p50: getPercentile(sorted, 50) / MS_TO_SECONDS,
    p95: getPercentile(sorted, 95) / MS_TO_SECONDS,
  };
}

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
