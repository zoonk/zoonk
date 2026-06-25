export function validateOffset(value?: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export function sumOf(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

type LocalizedNumberOptions = {
  maximumFractionDigits?: number;
  notation?: "compact";
  signDisplay?: "always";
  style?: "percent";
  trailingZeroDisplay?: "stripIfInteger";
};

export type LocalizedNumberFormatter = {
  number: (value: number | bigint, options?: LocalizedNumberOptions) => string;
};

const COMPACT_NUMBER_OPTIONS = { notation: "compact" } satisfies LocalizedNumberOptions;

const METRIC_PERCENT_OPTIONS = {
  maximumFractionDigits: 1,
  style: "percent",
  trailingZeroDisplay: "stripIfInteger",
} satisfies LocalizedNumberOptions;

const SIGNED_METRIC_PERCENT_OPTIONS = {
  ...METRIC_PERCENT_OPTIONS,
  signDisplay: "always",
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
 * Formats metric comparisons stored as percentage-point deltas while preserving
 * the explicit sign that makes gains and drops easy to scan.
 */
export function formatSignedMetricPercent({
  format,
  value,
}: {
  format: LocalizedNumberFormatter;
  value: number;
}): string {
  return format.number(value / 100, SIGNED_METRIC_PERCENT_OPTIONS);
}

/**
 * Formats large chart-axis values compactly through the active locale, so
 * thousands and millions fit in tight axes without hard-coding English suffixes.
 */
export function formatCompactNumber({
  format,
  value,
}: {
  format: LocalizedNumberFormatter;
  value: number;
}): string {
  return format.number(value, COMPACT_NUMBER_OPTIONS);
}
