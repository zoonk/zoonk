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
