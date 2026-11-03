import { getNumberFormatter, parseLocalizedNumber } from "./localized-number";

/**
 * Money marks a lesson writes, with the currencies each can stand for, the locale's own first: a
 * lesson in Spanish (Mexico) writes pesos as "$".
 */
const MONEY_MARKS: ReadonlyMap<string, readonly string[]> = new Map([
  ["R$", ["BRL"]],
  ["US$", ["USD"]],
  ["A$", ["AUD"]],
  ["C$", ["CAD"]],
  ["zł", ["PLN"]],
  ["$", ["USD", "MXN", "CAD", "AUD"]],
  ["€", ["EUR"]],
  ["£", ["GBP"]],
  ["¥", ["JPY", "CNY"]],
  ["₹", ["INR"]],
  ["₩", ["KRW"]],
  ["₺", ["TRY"]],
]);

const DECIMAL_SAMPLE = 1.5;

const MARK = [...MONEY_MARKS.keys()].map((mark) => mark.replaceAll("$", String.raw`\$`)).join("|");
const AMOUNT = String.raw`\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?`;

/** A minus written after the money mark ("R$ -2.000,00"), which no locale does. */
const SIGN_AFTER_MARK = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?<mark>${MARK})\s?[-−–](?<amount>${AMOUNT})(?!\d)`,
  "gu",
);

function currencyFor({ language, mark }: { language: string; mark: string }): string | null {
  const candidates = MONEY_MARKS.get(mark) ?? [];

  const local = candidates.find((currency) =>
    getNumberFormatter(language, { currency, style: "currency" })
      .formatToParts(1)
      .some((part) => part.type === "currency" && part.value === mark),
  );

  return local ?? candidates[0] ?? null;
}

function fractionDigits({ amount, language }: { amount: string; language: string }): number {
  const decimal = getNumberFormatter(language, {})
    .formatToParts(DECIMAL_SAMPLE)
    .find((part) => part.type === "decimal")?.value;

  const at = decimal ? amount.lastIndexOf(decimal) : -1;
  return at === -1 ? 0 : amount.length - at - 1;
}

/**
 * Rewrites a negative amount whose minus sits after the money mark the way the lesson's locale
 * writes it ("-R$ 2.000,00" in Portuguese), keeping the amount's own digits.
 */
export function repairNegativeMoney({
  language,
  text,
}: {
  language: string;
  text: string;
}): string {
  return text.replaceAll(SIGN_AFTER_MARK, (match: string, mark: string, amount: string) => {
    const currency = currencyFor({ language, mark });
    const value = parseLocalizedNumber({ locale: language, text: amount });

    if (!currency || value === null) {
      return match;
    }

    const digits = fractionDigits({ amount, language });

    return getNumberFormatter(language, {
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
      style: "currency",
    }).format(-value);
  });
}
