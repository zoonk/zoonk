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

/**
 * Formats count-style values through the app formatter so grouping and digits
 * follow the active locale instead of the runtime default locale.
 */
export function formatWholeNumber({
  format,
  value,
}: {
  format: LocalizedNumberFormatter;
  value: number;
}): string {
  return format.number(value);
}

/**
 * Formats progress percentages stored as 0-100 values. Intl percent formatting
 * expects a ratio, so this helper keeps the conversion in one place.
 */
export function formatMetricPercent({
  format,
  value,
}: {
  format: LocalizedNumberFormatter;
  value: number;
}): string {
  return format.number(value / 100, METRIC_PERCENT_OPTIONS);
}

/**
 * A goal's progress in its plan's lessons (a share from 0 to 1) to the hundredth of a percent:
 * "0.16%", "35.29%", "25%". Each lesson of a long plan moves it, where a whole percentage would sit
 * at "0%" for weeks. Every screen that shows it (the Plan, Today, a session's end) writes it here,
 * so they all read the same; a phase's, chapter's or subject's share stays in whole percentages.
 */
export function formatGoalProgress({
  format,
  share,
}: {
  format: LocalizedNumberFormatter;
  share: number;
}): string {
  return format.number(share, GOAL_PROGRESS_OPTIONS);
}
