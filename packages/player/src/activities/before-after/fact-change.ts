const SIGNIFICANT_DIGITS = 2;
const TIMES_FROM = 2;
const PERCENT = 100;
const SAME_SLACK = 1e-9;

export type FactChange =
  | { kind: "same" }
  | { kind: "less" | "more"; times: number }
  | { kind: "percent"; percent: number };

/**
 * How a fact changed from before to after, the way people say it: "8.3 times less" for big
 * changes, "+15%" for small ones. The ratio (after divided by before) comes from core.
 */
export function describeChange(ratio: number): FactChange {
  if (Math.abs(ratio - 1) < SAME_SLACK) {
    return { kind: "same" };
  }

  if (ratio > 0 && ratio <= 1 / TIMES_FROM) {
    return { kind: "less", times: Number((1 / ratio).toPrecision(SIGNIFICANT_DIGITS)) };
  }

  if (ratio >= TIMES_FROM) {
    return { kind: "more", times: Number(ratio.toPrecision(SIGNIFICANT_DIGITS)) };
  }

  return {
    kind: "percent",
    percent: Number(((ratio - 1) * PERCENT).toPrecision(SIGNIFICANT_DIGITS)),
  };
}

/** A bar length for each state's value, against the larger of the two, so both share a scale. */
export function barShares(before: number, after: number): { after: number; before: number } {
  const largest = Math.max(Math.abs(before), Math.abs(after));

  return largest === 0
    ? { after: 0, before: 0 }
    : { after: Math.abs(after) / largest, before: Math.abs(before) / largest };
}
