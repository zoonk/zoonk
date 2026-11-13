import { type LatencyBudget } from "./types";

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSeconds(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${value.toFixed(2)}s`;
}

export function formatDollars(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`;
}

/**
 * Formats a cost column. A cost under $1 needs four decimals; when a column has one, every cost in
 * it takes four, so the values end on one edge with their decimal points in line.
 */
export function formatDollarsColumn<Entry>(
  entries: Entry[],
  cost: (entry: Entry) => number | null,
) {
  const hasSmallCosts = entries.some((entry) => {
    const value = cost(entry);
    return value !== null && value < 1;
  });

  return function formatCell(entry: Entry): string {
    const value = cost(entry);
    return value !== null && hasSmallCosts ? `$${value.toFixed(4)}` : formatDollars(value);
  };
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
