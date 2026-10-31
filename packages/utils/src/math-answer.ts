import { getNumberFormatter } from "./localized-number";

const MAX_FRACTION_DIGITS = 2;
const SMALL_VALUE_SIGNIFICANT_DIGITS = 2;
const SMALL_VALUE = 0.01;

const MINUS_SIGN = "−";
const MONEY_FRACTION_DIGITS = 2;
const WHOLE_MONEY_FROM = 1000;

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

const ATTACHED_UNITS: ReadonlySet<string> = new Set(["%", "°", "‰"]);

const NO_BREAK_SPACE = " ";

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

/** Cents show only when there are some and the amount is small ($3.50, $200, $103,449). */
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

export function withUnit(formatted: string, unit?: string | null): string {
  if (!unit) {
    return formatted;
  }

  return ATTACHED_UNITS.has(unit) ? `${formatted}${unit}` : `${formatted}${NO_BREAK_SPACE}${unit}`;
}

export function getUnitPosition({
  language,
  unit,
}: {
  language: string;
  unit: string;
}): "prefix" | "suffix" {
  const currency = currencyFor(unit);
  return currency ? currencyLayout({ currency, language }).position : "suffix";
}

/** Null for a sign that isn't money, or a language that writes money after the amount ("80 €"). */
export function moneySignGap({
  language,
  sign,
}: {
  language: string;
  sign: string;
}): string | null {
  const currency = currencyFor(sign);

  if (!currency) {
    return null;
  }

  const layout = currencyLayout({ currency, language });
  return layout.position === "prefix" ? layout.gap : null;
}

function currencyLayout({
  currency,
  language,
}: {
  currency: string;
  language: string;
}): { gap: string; position: "prefix" } | { position: "suffix" } {
  const parts = getNumberFormatter(language, { currency, style: "currency" }).formatToParts(1);
  const symbol = parts.findIndex((part) => part.type === "currency");
  const number = parts.findIndex((part) => part.type === "integer");

  if (symbol > number) {
    return { position: "suffix" };
  }

  const gap = parts
    .slice(symbol + 1, number)
    .map((part) => part.value)
    .join("");

  return { gap, position: "prefix" };
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
 * `maximumFractionDigits` keeps a finer answer exact where two decimals would make a near miss read
 * like the answer (`exactFractionDigitsFor`).
 */
export function formatMathAnswer({
  language,
  maximumFractionDigits,
  unit,
  value,
}: {
  language: string;
  maximumFractionDigits?: number;
  unit: string | null;
  value: number;
}): string {
  const currency = currencyFor(unit);

  if (currency) {
    return formatMoney({
      currency,
      locale: language,
      maximumFractionDigits: maximumFractionDigits ?? MONEY_FRACTION_DIGITS,
      value,
    });
  }

  const number =
    maximumFractionDigits === undefined
      ? formatNumber({ language, value })
      : getNumberFormatter(language, { maximumFractionDigits }).format(value);

  return withUnit(number, unit);
}
