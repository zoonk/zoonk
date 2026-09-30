import { getNumberFormatter } from "./localized-number";

/** Answers read best with up to two decimals, like money; tiny values keep two significant digits. */
const MAX_FRACTION_DIGITS = 2;
const SMALL_VALUE_SIGNIFICANT_DIGITS = 2;
const SMALL_VALUE = 0.01;

const MINUS_SIGN = "−";
const MONEY_FRACTION_DIGITS = 2;
const WHOLE_MONEY_FROM = 1000;

/** Currency symbols writers use, and the currency each one means. */
const CURRENCY_SYMBOLS: ReadonlyMap<string, string> = new Map([
  ["$", "USD"],
  ["A$", "AUD"],
  ["C$", "CAD"],
  ["R$", "BRL"],
  ["US$", "USD"],
  ["£", "GBP"],
  ["¥", "JPY"],
  ["€", "EUR"],
  ["₹", "INR"],
]);

const ISO_CODE = /^[A-Z]{3}$/u;

/** Units that sit right after the number, like "7%" or "45°". */
const ATTACHED_UNITS: ReadonlySet<string> = new Set(["%", "°", "‰"]);

const NO_BREAK_SPACE = " ";

/**
 * The currency a unit stands for, like "USD" for "$", so money is written the way the learner's
 * language writes it ("$1,000" in English, "US$ 1.000" in Portuguese). Anything that isn't money
 * returns null.
 */
export function currencyFor(unit?: string | null): string | null {
  if (!unit) {
    return null;
  }

  return CURRENCY_SYMBOLS.get(unit) ?? (ISO_CODE.test(unit) ? unit : null);
}

function isWhole(value: number, digits: number): boolean {
  const scale = 10 ** digits;
  return Math.round(value * scale) % scale === 0;
}

/**
 * Formats an amount of money in the learner's language. Cents show only when there are some and
 * the amount is small ($3.50, $200, $103,449), unless the caller asks for exact digits.
 */
export function formatMoney({
  compact = false,
  currency,
  locale,
  maximumFractionDigits,
  signed = false,
  value,
}: {
  compact?: boolean;
  currency: string;
  locale: string;
  maximumFractionDigits?: number;
  signed?: boolean;
  value: number;
}): string {
  const whole = Math.abs(value) >= WHOLE_MONEY_FROM || isWhole(value, MONEY_FRACTION_DIGITS);
  const digits = maximumFractionDigits ?? (whole ? 0 : MONEY_FRACTION_DIGITS);
  const minimum = isWhole(value, digits) ? 0 : Math.min(digits, MONEY_FRACTION_DIGITS);

  const formatted = getNumberFormatter(locale, {
    currency,
    maximumFractionDigits: Math.max(digits, minimum),
    minimumFractionDigits: minimum,
    notation: compact ? "compact" : "standard",
    signDisplay: signed ? "exceptZero" : "auto",
    style: "currency",
  }).format(value);

  return formatted.replace("-", MINUS_SIGN);
}

/**
 * Writes a formatted number with a unit that isn't money (see `currencyFor`): percent and degree
 * signs attach, and everything else follows after a non-breaking space, so "130 m" never wraps
 * between the number and its unit.
 */
export function withUnit(formatted: string, unit?: string | null): string {
  if (!unit) {
    return formatted;
  }

  return ATTACHED_UNITS.has(unit) ? `${formatted}${unit}` : `${formatted}${NO_BREAK_SPACE}${unit}`;
}

/**
 * Where a unit goes next to an answer field: money where the learner's language writes its
 * currency ("R$ 45", but "45 €" in German), every other unit after the number.
 */
export function getUnitPosition({
  language,
  unit,
}: {
  language: string;
  unit: string;
}): "prefix" | "suffix" {
  const currency = currencyFor(unit);

  if (!currency) {
    return "suffix";
  }

  const parts = getNumberFormatter(language, { currency, style: "currency" }).formatToParts(1);
  const symbol = parts.findIndex((part) => part.type === "currency");
  const number = parts.findIndex((part) => part.type === "integer");

  return symbol < number ? "prefix" : "suffix";
}

function formatNumber({ language, value }: { language: string; value: number }): string {
  const magnitude = Math.abs(value);

  const options: Intl.NumberFormatOptions =
    magnitude > 0 && magnitude < SMALL_VALUE
      ? { maximumSignificantDigits: SMALL_VALUE_SIGNIFICANT_DIGITS }
      : { maximumFractionDigits: MAX_FRACTION_DIGITS };

  return getNumberFormatter(language, options).format(value);
}

/**
 * Shows a math answer the way people write it in their language: "R$ 45,50", "12.5%" or "3 km".
 * Lesson checks, session questions, the notebook and the activities write units this way.
 */
export function formatMathAnswer({
  language,
  unit,
  value,
}: {
  language: string;
  unit: string | null;
  value: number;
}): string {
  const currency = currencyFor(unit);

  if (currency) {
    return formatMoney({
      currency,
      locale: language,
      maximumFractionDigits: MONEY_FRACTION_DIGITS,
      value,
    });
  }

  return withUnit(formatNumber({ language, value }), unit);
}
