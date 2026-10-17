import { type LatencyBudget } from "./types";

/** Shared number formats so the dashboard and the CLI report read the same. */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

/** Eval costs are often fractions of a cent, so small amounts keep more digits. */
export function formatDollars(value: number): string {
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

export function formatLatencyBudget(budget: LatencyBudget): string {
  return `p50 ≤ ${formatSeconds(budget.p50)}, p95 ≤ ${formatSeconds(budget.p95)}`;
}

/** Whether a model meets the task's latency budget; a dash when there is nothing to judge. */
export function formatLatencyVerdict(meetsBudget: boolean | null): string {
  if (meetsBudget === null) {
    return "—";
  }

  return meetsBudget ? "meets" : "over";
}
