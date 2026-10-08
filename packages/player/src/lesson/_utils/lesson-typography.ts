import { getNumberFormatter } from "@zoonk/utils/localized-number";

const NBSP = " ";

/**
 * A whole number of five digits or more written without grouping ("350000"), not part of a
 * decimal, a code, a date or a word, and not starting with 0 (a postal code or an ID).
 */
const LONG_NUMBER = /(?<![\d.,\p{L}/-])[1-9]\d{4,}(?![\d\p{L}/-]|[.,]\d)/gu;

/** Units lessons write after a number, in their own case ("A" is amperes, "a" is a word). */
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

/** A number and the unit after it ("3 Ω", "12 V", "350 kcal", "20 %"). */
const NUMBER_THEN_UNIT = new RegExp(`(?<=\\d) (?=(?:${UNIT_PATTERN})(?![\\p{L}\\d]))`, "gu");

/** A currency sign and the amount after it ("R$ 80", "US$ 5", "€ 20"). */
const CURRENCY_THEN_NUMBER = /(?<=\p{Sc}) (?=\d)/gu;

/**
 * Lesson text written by AI, set the way the learner's language prints numbers: long numbers
 * grouped ("350.000" in Portuguese), and a number never split from its unit or currency at the end
 * of a line.
 */
export function typesetNumbers({ locale, text }: { locale: string; text: string }): string {
  const grouping = getNumberFormatter(locale, { useGrouping: true });

  return text
    .replaceAll(LONG_NUMBER, (digits) => grouping.format(Number(digits)))
    .replaceAll(NUMBER_THEN_UNIT, NBSP)
    .replaceAll(CURRENCY_THEN_NUMBER, NBSP);
}
