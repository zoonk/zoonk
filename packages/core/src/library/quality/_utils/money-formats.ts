import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import { CURRENCY_MARKS, CURRENCY_WORDS, MONEY_MARK, MONEY_WORD } from "@zoonk/utils/money-marks";
import { getScreenTexts } from "./screen-texts";

const AMOUNT = String.raw`\d{1,3}(?:[.,\u00A0\u202F ]\d{3})*(?:[.,]\d{2})?(?!\d)|\d+(?:[.,]\d{2})?(?!\d)`;

const MONEY = new RegExp(
  String.raw`(?<markBefore>${MONEY_MARK})\s?(?<before>${AMOUNT})|(?<after>${AMOUNT})\s?(?<markAfter>${MONEY_MARK})|(?<spelled>${AMOUNT})\s(?:mil\s)?(?<word>${MONEY_WORD})\b`,
  "gu",
);

const ZERO_CENTS = /[.,]00$/u;
const CENTS = /[.,]\d{2}$/u;

type MoneyMention = { currency: string; form: string; screen: number; text: string };

function toMention(match: RegExpMatchArray, screen: number): MoneyMention | null {
  const { after, before, markAfter, markBefore, spelled, word } = match.groups ?? {};
  const amount = before ?? after;
  const mark = markBefore ?? markAfter;

  if (spelled && word) {
    return { currency: CURRENCY_WORDS.get(word) ?? word, form: "spelled", screen, text: match[0] };
  }

  // An amount with real cents (R$ 2,50) is written the only way it can be.
  if (!amount || !mark || (CENTS.test(amount) && !ZERO_CENTS.test(amount))) {
    return null;
  }

  return {
    currency: CURRENCY_MARKS.get(mark) ?? mark,
    form: `${mark} ${ZERO_CENTS.test(amount) ? "cents" : "whole"}`,
    screen,
    text: match[0].trim(),
  };
}

/**
 * A lesson writes each currency one way: the same mark, and cents on every whole amount or on
 * none. Two currencies are never compared, since a lesson may set prices side by side. Pairs each
 * other way a currency is written with its first mention.
 */
export function findMixedMoneyFormats(
  screens: readonly WrittenScreen[],
): { first: MoneyMention; mention: MoneyMention }[] {
  const mentions = screens.flatMap((screen, index) =>
    getScreenTexts(screen).flatMap((piece) =>
      [...piece.text.matchAll(MONEY)].flatMap((match) => toMention(match, index) ?? []),
    ),
  );

  const firsts = mentions.filter(
    (mention, index) =>
      mentions.findIndex(
        (other) => other.currency === mention.currency && other.form === mention.form,
      ) === index,
  );

  return firsts.flatMap((mention) => {
    const first = firsts.find((other) => other.currency === mention.currency);
    return first && first !== mention ? [{ first, mention }] : [];
  });
}
