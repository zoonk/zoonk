import { type LatencyBudget } from "./types";

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

export function formatDollars(value: number): string {
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

export function formatLatencyBudget(budget: LatencyBudget): string {
  return `p50 ≤ ${formatSeconds(budget.p50)}, p95 ≤ ${formatSeconds(budget.p95)}`;
}

export function formatLatencyVerdict(meetsBudget: boolean | null): string {
  if (meetsBudget === null) {
    return "—";
  }

  return meetsBudget ? "meets" : "over";
}
