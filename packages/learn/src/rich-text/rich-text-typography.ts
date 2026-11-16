import { getNumberFormatter } from "@zoonk/utils/localized-number";
import { moneySignGap } from "@zoonk/utils/math-answer";

const NBSP = " ";

/**
 * Five digits or more without grouping ("350000"), not part of a decimal, code, date or word, and
 * not starting with 0 (a postal code or an ID).
 */
const LONG_NUMBER = /(?<![\d.,\p{L}/-])[1-9]\d{4,}(?![\d\p{L}/-]|[.,]\d)/gu;

/** A postal code's label right before it ("ZIP 94103", "PLZ 10115"), or a city's state code ("San Francisco, CA 94103"). */
const POSTAL_LABEL =
  /\b(?:zip(?: code)?|postal code|postcode|plz|postleitzahl|cep|cp|code postal|código postal):?\s$/iu;

const STATE_CODE = /,\s\p{Lu}{2},?\s$/u;

function isPostalCode(before: string): boolean {
  return POSTAL_LABEL.test(before) || STATE_CODE.test(before);
}

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

/** A sign and its amount, apart by a space or by the no-break space a question's text keeps them with. */
const CURRENCY_THEN_NUMBER = /(?<sign>\p{Lu}{0,2}\p{Sc})[  ](?=\d)/gu;

/**
 * Only money, written the way the learner's money format writes it: a question's own text keeps its
 * other digits (a code in a table, an ID, a count it asks about) as written.
 */
export function typesetMoney({ locale, text }: { locale: string; text: string }): string {
  return text.replaceAll(
    CURRENCY_THEN_NUMBER,
    (_money, sign: string) => `${sign}${moneySignGap({ language: locale, sign }) ?? NBSP}`,
  );
}

type Segment = { kind: string; text: string };

const KEPT_AS_WRITTEN = new Set(["code", "displayMath", "math"]);

/** A sign that ends a segment, apart from an amount the next segment starts ("R$ **80**"). */
const SIGN_AT_END = /(?<sign>\p{Lu}{0,2}\p{Sc})[  ]$/u;

const STARTS_WITH_DIGIT = /^\d/u;

/**
 * Prose segments set by `typeset`, math and code as written, and a money sign kept with the amount
 * the next prose segment starts with, as money in one segment is.
 */
export function typesetProse<T extends Segment>({
  locale,
  segments,
  typeset,
}: {
  locale: string;
  segments: readonly T[];
  typeset: (text: string) => string;
}): T[] {
  const isProse = (segment: T | undefined) => segment && !KEPT_AS_WRITTEN.has(segment.kind);

  return segments.map((segment, index) => {
    if (!isProse(segment)) {
      return segment;
    }

    const next = segments[index + 1];
    const text = typeset(segment.text);

    return {
      ...segment,
      text:
        next && isProse(next) && STARTS_WITH_DIGIT.test(next.text)
          ? text.replace(
              SIGN_AT_END,
              (_money, sign: string) =>
                `${sign}${moneySignGap({ language: locale, sign }) ?? NBSP}`,
            )
          : text,
    };
  });
}

export function typesetNumbers({ locale, text }: { locale: string; text: string }): string {
  const grouping = getNumberFormatter(locale, { useGrouping: true });

  return typesetMoney({
    locale,
    text: text
      .replaceAll(LONG_NUMBER, (digits: string, offset: number) =>
        isPostalCode(text.slice(0, offset)) ? digits : grouping.format(Number(digits)),
      )
      .replaceAll(NUMBER_THEN_UNIT, NBSP),
  });
}
