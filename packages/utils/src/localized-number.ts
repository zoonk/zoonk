const DEFAULT_FRACTION_DIGITS = 2;
const MINUS_SIGN = "\u2212";
const TEN = 10;
const THOUSAND = 1000;
const MAX_FRACTION_DIGITS = 20;

/** Any number with a fraction, formatted to find the locale's decimal separator. */
const DECIMAL_SAMPLE = 1.5;

const formatters = new Map<string, Intl.NumberFormat>();

/** One cached `Intl.NumberFormat` per locale and options, since building one is slow. */
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

/**
 * Formats a number the way people read it in their language. Computed values often carry float
 * noise (3869.684462...), so they're rounded for display only; grading always uses the full value.
 */
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

/** Significant digits a value below one keeps, so 0.000075 m never reads as 0 m. */
const SMALL_SIGNIFICANT_DIGITS = 3;

/**
 * Decimals worth showing for a value's size: none for thousands ($3,870), one for tens (130.5 m),
 * two for ones (5.25) and three significant digits below one (0.125, 0.0000752), so a readout never
 * shows float noise and a tiny value never rounds to 0.
 */
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

function decimalSeparator(locale: string): string {
  return (
    getNumberFormatter(locale, { minimumFractionDigits: 1 })
      .formatToParts(DECIMAL_SAMPLE)
      .find((part) => part.type === "decimal")?.value ?? "."
  );
}

/** Spaces, including the narrow ones some locales group digits with. */
const SPACES = /[\s\u00A0\u202F]/gu;

const GROUPED_DIGITS = /^[+-]?\d{1,3}(?:[.,]\d{3})+$/u;

/**
 * When only one kind of separator appears, it's a decimal point ("3,5" or "3.5" in any language)
 * unless it groups thousands the locale's way, like "1,000" in English or "1.000" in Portuguese.
 */
function normalizeOneSeparator(text: string, separator: string, locale: string): string {
  const groupsThousands = decimalSeparator(locale) !== separator && GROUPED_DIGITS.test(text);
  return groupsThousands ? text.replaceAll(separator, "") : text.replace(separator, ".");
}

/** When both appear, the learner's locale decides which one groups digits. */
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

/**
 * Reads a number the learner typed, accepting their locale's decimal comma, the typographic minus
 * and surrounding spaces. Returns null for anything that isn't one plain number.
 */
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
