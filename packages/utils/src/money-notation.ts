import { getNumberFormatter } from "./localized-number";
import { MONEY_AMOUNT, MONEY_MARK } from "./money-marks";
import { repairNegativeMoney } from "./negative-money";

const CONNECTOR = String.raw`\s?[–—~〜-]\s?|\s(?:a|à|até|bis|do|hasta|to)\s`;

const AMOUNT_AFTER_MARK = new RegExp(
  String.raw`(?<=(?<![\p{L}\p{N}])(?:${MONEY_MARK})\s?)(?:${MONEY_AMOUNT})(?![.,]?\d)`,
  "gu",
);

const RANGE_END = new RegExp(
  String.raw`(?<=(?<![\p{L}\p{N}])(?:${MONEY_MARK})\s?(?:${MONEY_AMOUNT})(?:${CONNECTOR}))(?:${MONEY_AMOUNT})(?![.,]?\d)`,
  "gu",
);

const AMOUNT_BEFORE_MARK = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])(?:${MONEY_AMOUNT})(?![.,]?\d)(?=\s?(?:${MONEY_MARK})(?!\p{L}))`,
  "gu",
);

const RANGE_START = new RegExp(
  String.raw`(?<![\p{L}\p{N}.,])(?:${MONEY_AMOUNT})(?![.,]?\d)(?=(?:${CONNECTOR})(?:${MONEY_AMOUNT})\s?(?:${MONEY_MARK})(?!\p{L}))`,
  "gu",
);

const MONEY_AMOUNTS = [AMOUNT_AFTER_MARK, RANGE_END, AMOUNT_BEFORE_MARK, RANGE_START];

const BARE_UNITS = /^[1-9]\d*$/u;
const SPACE = /\s/u;
const NOTATION_SAMPLE = 12_345.5;
const ZERO_CENTS = "00";

type Notation = { decimal: string; pattern: RegExp };
type ReadAmount = { cents: string | undefined; units: string };

function getNotation(language: string): Notation {
  const parts = getNumberFormatter(language, {}).formatToParts(NOTATION_SAMPLE);
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const groupMarks = SPACE.test(group) ? String.raw`\u00A0\u202F ` : group;

  const pattern = new RegExp(
    String.raw`^(?<units>0|[1-9]\d*|[1-9]\d{0,2}(?:[${groupMarks}]\d{3})+)(?:[${decimal}](?<cents>\d{2}))?$`,
    "u",
  );

  return { decimal, pattern };
}

function readAmount({
  amount,
  notation,
}: {
  amount: string;
  notation: Notation;
}): ReadAmount | null {
  const groups = notation.pattern.exec(amount)?.groups;
  return groups?.units ? { cents: groups.cents, units: groups.units } : null;
}

function findAmounts(text: string): string[] {
  return MONEY_AMOUNTS.flatMap((pattern) => [...text.matchAll(pattern)].map(([amount]) => amount));
}

/**
 * Rewrites how the money in `texts` is written, never what it's worth: a minus moves in front of
 * the mark, a bare amount gets the language's thousands separator, and zero cents go only when
 * every amount is whole, both ends of a range included. An amount the language's notation can't
 * read for sure (R$ 2,400 in Portuguese) stays as written and keeps the zero cents everywhere.
 */
export function createMoneyNotationRepair({
  language,
  texts,
}: {
  language: string;
  texts: readonly string[];
}): (text: string) => string {
  const notation = getNotation(language);
  const grouper = getNumberFormatter(language, { maximumFractionDigits: 0 });

  const allWhole = texts
    .flatMap((text) => findAmounts(repairNegativeMoney({ text })))
    .every((amount) => {
      const parsed = readAmount({ amount, notation });
      return parsed !== null && (parsed.cents ?? ZERO_CENTS) === ZERO_CENTS;
    });

  const rewrite = (amount: string): string => {
    const parsed = readAmount({ amount, notation });

    if (!parsed) {
      return amount;
    }

    const { cents, units } = parsed;
    const grouped = BARE_UNITS.test(units) ? grouper.format(BigInt(units)) : units;
    const keepsCents = cents !== undefined && !(allWhole && cents === ZERO_CENTS);

    return keepsCents ? `${grouped}${notation.decimal}${cents}` : grouped;
  };

  return (text) =>
    MONEY_AMOUNTS.reduce(
      (written, pattern) => written.replaceAll(pattern, rewrite),
      repairNegativeMoney({ text }),
    );
}
