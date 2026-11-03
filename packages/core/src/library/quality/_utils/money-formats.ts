import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { getScreenTexts } from "./screen-texts";

const MARK = String.raw`(?:R\$|US\$|A\$|C\$|\$|€|£|¥|₩|₹|₺|zł)`;
const AMOUNT = String.raw`\d{1,3}(?:[.,   ]\d{3})*(?:[.,]\d{2})?(?!\d)|\d+(?:[.,]\d{2})?(?!\d)`;
const WORD = String.raw`(?:reais|real|dólares|dólar|dollars|dollar|euros|euro|pesos|peso)`;

const MONEY = new RegExp(
  String.raw`${MARK}\s?(?<before>${AMOUNT})|(?<after>${AMOUNT})\s?${MARK}|(?<spelled>${AMOUNT})\s(?:mil\s)?${WORD}\b`,
  "gu",
);

const ZERO_CENTS = /[.,]00$/u;
const CENTS = /[.,]\d{2}$/u;

type MoneyFormat = "cents" | "spelled" | "whole";
type MoneyMention = { format: MoneyFormat; screen: number; text: string };

function toMention(match: RegExpMatchArray, screen: number): MoneyMention | null {
  const { after, before, spelled } = match.groups ?? {};
  const amount = before ?? after;

  if (spelled) {
    return { format: "spelled", screen, text: match[0] };
  }

  // An amount with real cents (R$ 2,50) is written the only way it can be.
  if (!amount || (CENTS.test(amount) && !ZERO_CENTS.test(amount))) {
    return null;
  }

  return { format: ZERO_CENTS.test(amount) ? "cents" : "whole", screen, text: match[0].trim() };
}

/**
 * A lesson writes money one way: the same currency mark, and cents on every whole amount or on
 * none. Returns the first mention of each format the lesson uses, when it uses more than one.
 */
export function findMixedMoneyFormats(screens: readonly WrittenScreen[]): MoneyMention[] {
  const mentions = screens.flatMap((screen, index) =>
    getScreenTexts(screen).flatMap((piece) =>
      [...piece.text.matchAll(MONEY)].flatMap((match) => toMention(match, index) ?? []),
    ),
  );

  const firsts = mentions.filter(
    (mention, index) => mentions.findIndex((other) => other.format === mention.format) === index,
  );

  return firsts.length > 1 ? firsts : [];
}
