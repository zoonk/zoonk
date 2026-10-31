export function validateOffset(value?: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

type LocalizedNumberOptions = {
  maximumFractionDigits?: number;
  style?: "percent";
  trailingZeroDisplay?: "stripIfInteger";
};

export type LocalizedNumberFormatter = {
  number: (value: number | bigint, options?: LocalizedNumberOptions) => string;
};

const METRIC_PERCENT_OPTIONS = {
  maximumFractionDigits: 1,
  style: "percent",
  trailingZeroDisplay: "stripIfInteger",
} satisfies LocalizedNumberOptions;

const GOAL_PROGRESS_OPTIONS = {
  maximumFractionDigits: 2,
  style: "percent",
} satisfies LocalizedNumberOptions;

export function formatWholeNumber({
  format,
  value,
}: {
  format: LocalizedNumberFormatter;
  value: number;
}): string {
  return format.number(value);
}

/** Takes 0–100; Intl's percent style expects a ratio. */
export function formatMetricPercent({
  format,
  value,
}: {
  format: LocalizedNumberFormatter;
  value: number;
}): string {
  return format.number(value / 100, METRIC_PERCENT_OPTIONS);
}

/** To the hundredth of a percent, since a whole percentage would sit at "0%" for weeks. */
export function formatGoalProgress({
  format,
  share,
}: {
  format: LocalizedNumberFormatter;
  share: number;
}): string {
  return format.number(share, GOAL_PROGRESS_OPTIONS);
}
