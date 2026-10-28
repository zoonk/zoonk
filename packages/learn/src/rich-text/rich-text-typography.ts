import { getNumberFormatter } from "@zoonk/utils/localized-number";
import { moneySignGap } from "@zoonk/utils/math-answer";

const NBSP = " ";

/** Five digits or more without grouping ("350000"), not part of a decimal, code, date or word, and not starting with 0 (a postal code or an ID). */
const LONG_NUMBER = /(?<![\d.,\p{L}/-])[1-9]\d{4,}(?![\d\p{L}/-]|[.,]\d)/gu;

/** In their own case: "A" is amperes, "a" is a word. */
const UNITS = [
  "%",
  "°C",
  "°F",
  "A",
  "B",
  "GB",
  "GHz",
  "Hz",
  "J",
  "K",
  "KB",
  "L",
  "MB",
  "MHz",
  "N",
  "Pa",
  "TB",
  "V",
  "W",
  "cal",
  "cm",
  "cm²",
  "cm³",
  "g",
  "h",
  "ha",
  "kHz",
  "kJ",
  "kW",
  "kWh",
  "kcal",
  "kg",
  "km",
  "km/h",
  "km²",
  "l",
  "m",
  "m/s",
  "mA",
  "mL",
  "mg",
  "min",
  "ml",
  "mm",
  "mol",
  "ms",
  "m²",
  "m³",
  "nm",
  "rpm",
  "s",
  "t",
  "µm",
  "Ω",
  "kΩ",
];

/** Longest first, so "km/h" wins over "km". */
const UNIT_PATTERN = UNITS.toSorted((a, b) => b.length - a.length).join("|");

const NUMBER_THEN_UNIT = new RegExp(`(?<=\\d) (?=(?:${UNIT_PATTERN})(?![\\p{L}\\d]))`, "gu");

const CURRENCY_THEN_NUMBER = /(?<sign>\p{Lu}{0,2}\p{Sc}) (?=\d)/gu;

export function typesetNumbers({ locale, text }: { locale: string; text: string }): string {
  const grouping = getNumberFormatter(locale, { useGrouping: true });

  return text
    .replaceAll(LONG_NUMBER, (digits) => grouping.format(Number(digits)))
    .replaceAll(NUMBER_THEN_UNIT, NBSP)
    .replaceAll(
      CURRENCY_THEN_NUMBER,
      (_money, sign: string) => `${sign}${moneySignGap({ language: locale, sign }) ?? NBSP}`,
    );
}
