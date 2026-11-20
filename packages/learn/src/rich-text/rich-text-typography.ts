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

const NUMBER_THEN_WORD = /(?<=\d)[ \t]+(?=[\p{L}%°])/gu;
const NUMBER_AT_END = /(?<=\d)[ \t]+$/u;
const LEADING_SPACE = /^[ \t]+/u;
const ENDS_WITH_DIGIT = /\d$/u;
const STARTS_WITH_WORD = /^[\p{L}%°]/u;

/** A sign and its amount, apart by a space or by the no-break space a question's text keeps them with. */
const CURRENCY_THEN_NUMBER = /(?<sign>\p{Lu}{0,2}\p{Sc})[  ](?=\d)/gu;

/**
 * Only money, written the way the learner's money format writes it: a question's own text keeps its
 * other digits (a code in a table, an ID, a count it asks about) as written.
 */
function typesetMoney({ locale, text }: { locale: string; text: string }): string {
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

    const previous = segments[index - 1];
    const next = segments[index + 1];
    const text = typeset(segment.text);

    const joinsPrevious =
      previous &&
      isProse(previous) &&
      ENDS_WITH_DIGIT.test(previous.text) &&
      STARTS_WITH_WORD.test(text.trimStart());

    const joined = joinsPrevious ? text.replace(LEADING_SPACE, NBSP) : text;

    if (!next || !isProse(next)) {
      return { ...segment, text: joined };
    }

    const withNumber = STARTS_WITH_WORD.test(next.text)
      ? joined.replace(NUMBER_AT_END, NBSP)
      : joined;

    return {
      ...segment,
      text: STARTS_WITH_DIGIT.test(next.text)
        ? withNumber.replace(
            SIGN_AT_END,
            (_money, sign: string) => `${sign}${moneySignGap({ language: locale, sign }) ?? NBSP}`,
          )
        : withNumber,
    };
  });
}

export function typesetNumbers({
  group = true,
  locale,
  text,
}: {
  group?: boolean;
  locale: string;
  text: string;
}): string {
  const together = text.replaceAll(NUMBER_THEN_WORD, NBSP);

  if (!group) {
    return typesetMoney({ locale, text: together });
  }

  const grouping = getNumberFormatter(locale, { useGrouping: true });

  return typesetMoney({
    locale,
    text: together.replaceAll(LONG_NUMBER, (digits: string, offset: number) =>
      isPostalCode(together.slice(0, offset)) ? digits : grouping.format(Number(digits)),
    ),
  });
}
