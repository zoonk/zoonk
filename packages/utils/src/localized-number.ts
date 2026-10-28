const DEFAULT_FRACTION_DIGITS = 2;
const MINUS_SIGN = "\u2212";
const TEN = 10;
const THOUSAND = 1000;
const MAX_FRACTION_DIGITS = 20;

const DECIMAL_SAMPLE = 1.5;

const formatters = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  const cached = formatters.get(key);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat(locale, options);
  formatters.set(key, formatter);
  return formatter;
}

/** Rounded for display only; grading always uses the full value. */
export function formatLocalizedNumber({
  compact = false,
  grouping = true,
  locale,
  maximumFractionDigits = DEFAULT_FRACTION_DIGITS,
  signed = false,
  value,
}: {
  compact?: boolean;
  grouping?: boolean;
  locale: string;
  maximumFractionDigits?: number;
  signed?: boolean;
  value: number;
}): string {
  const digits = Math.min(Math.max(Math.round(maximumFractionDigits), 0), MAX_FRACTION_DIGITS);

  const formatted = getNumberFormatter(locale, {
    maximumFractionDigits: digits,
    notation: compact ? "compact" : "standard",
    signDisplay: signed ? "exceptZero" : "auto",
    useGrouping: grouping,
  }).format(value);

  /* A typographic minus reads as a sign, not a hyphen; `parseLocalizedNumber` accepts it back. */
  return formatted.replace(/^-/u, MINUS_SIGN);
}

const SMALL_SIGNIFICANT_DIGITS = 3;

export function fractionDigitsFor(value: number): number {
  const size = Math.abs(value);

  if (size >= THOUSAND) {
    return 0;
  }

  if (size >= TEN) {
    return 1;
  }

  if (size >= 1) {
    return DEFAULT_FRACTION_DIGITS;
  }

  if (size === 0) {
    return DEFAULT_FRACTION_DIGITS + 1;
  }

  const leadingZeros = Math.max(0, -Math.floor(Math.log10(size)) - 1);
  return Math.min(MAX_FRACTION_DIGITS, leadingZeros + SMALL_SIGNIFICANT_DIGITS);
}

function digitsForResolution(resolution: number): number {
  return Math.max(0, Math.ceil(-Math.log10(resolution)));
}

/**
 * A wrong answer keeps a digit beyond its difference from the expected one, so rounding never makes
 * both read the same.
 */
export function exactFractionDigitsFor({
  expected,
  tolerance,
  value = expected,
}: {
  expected: number;
  tolerance: { kind: "absolute" | "relative"; value: number };
  value?: number;
}): number {
  const allowed =
    tolerance.kind === "absolute" ? tolerance.value : tolerance.value * Math.abs(expected);

  if (allowed === 0) {
    return MAX_FRACTION_DIGITS;
  }

  const difference = Math.abs(value - expected);
  const differenceDigits = difference > allowed ? digitsForResolution(difference) + 1 : 0;

  return Math.min(
    MAX_FRACTION_DIGITS,
    Math.max(
      DEFAULT_FRACTION_DIGITS,
      fractionDigitsFor(expected),
      fractionDigitsFor(value),
      digitsForResolution(allowed),
      differenceDigits,
    ),
  );
}

function decimalSeparator(locale: string): string {
  return (
    getNumberFormatter(locale, { minimumFractionDigits: 1 })
      .formatToParts(DECIMAL_SAMPLE)
      .find((part) => part.type === "decimal")?.value ?? "."
  );
}

const SPACES = /[\s\u00A0\u202F]/gu;

const GROUPED_DIGITS = /^[+-]?\d{1,3}(?:[.,]\d{3})+$/u;

/**
 * A lone separator is a decimal point unless it groups thousands the locale's way, like "1,000" in
 * English or "1.000" in Portuguese.
 */
function normalizeOneSeparator(text: string, separator: string, locale: string): string {
  const groupsThousands = decimalSeparator(locale) !== separator && GROUPED_DIGITS.test(text);
  return groupsThousands ? text.replaceAll(separator, "") : text.replace(separator, ".");
}

function normalizeSeparators(text: string, locale: string): string {
  const [hasDot, hasComma] = [text.includes("."), text.includes(",")];

  if (hasDot && hasComma) {
    return decimalSeparator(locale) === ","
      ? text.replaceAll(".", "").replace(",", ".")
      : text.replaceAll(",", "");
  }

  if (hasComma) {
    return normalizeOneSeparator(text, ",", locale);
  }

  return hasDot ? normalizeOneSeparator(text, ".", locale) : text;
}

export function parseLocalizedNumber({
  locale,
  text,
}: {
  locale: string;
  text: string;
}): number | null {
  const cleaned = text.replaceAll(SPACES, "").replaceAll("\u2212", "-");

  if (!/^[+-]?[\d.,]+$/u.test(cleaned)) {
    return null;
  }

  const normalized = normalizeSeparators(cleaned, locale);

  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(normalized)) {
    return null;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
