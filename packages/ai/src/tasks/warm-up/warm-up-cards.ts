import { seededShuffle } from "@zoonk/utils/seeded-random";
import { replaceEmDashes } from "@zoonk/utils/string";
import { MARKDOWN_LINK, findPlaceholderText } from "@zoonk/utils/text-flaws";
import { z } from "zod";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the question, then its answers, then the reveal. */
export const rawWarmUpCardSchema = z.object({
  question: z.string(),
  options: z.array(z.object({ text: z.string(), correct: z.boolean() })),
  reveal: z.string(),
});
/* oxlint-enable eslint/sort-keys */

/** One card of `@zoonk/core`'s warm-up deck, whose contract composes this schema. */
export const warmUpCardSchema = z.object({
  id: z.string(),
  options: z.array(z.object({ correct: z.boolean(), id: z.string(), text: z.string() })),
  question: z.string(),
  reveal: z.string(),
});

export type RawWarmUpCard = z.infer<typeof rawWarmUpCardSchema>;
export type WarmUpCard = z.infer<typeof warmUpCardSchema>;

type RawOption = RawWarmUpCard["options"][number];

/** A deck shows the first 8 cards the checker keeps, and none when fewer than 2 are left. */
export const WARM_UP_DECK_SIZE = { max: 8, min: 2 } as const;

/** Well past the spec (about 110 characters, 6 words, 220), so only text that can't fit goes. */
const MAX_LENGTH = { option: 60, question: 160, reveal: 280 } as const;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 3;
const OPTION_IDS = ["a", "b", "c"] as const;

const NUMBER = /[-−]?\d+(?:[.,]\d+)*/gu;
const LINK = new RegExp(MARKDOWN_LINK.source, "gu");
const CODE_SPAN = /`(?<code>[^`\n]+)`/gu;
const BOLD = /(?<![\p{L}\p{N}])\*\*(?<words>\S(?:[^*\n]*\S)?)\*\*(?![\p{L}\p{N}])/gu;
const LINE_SPACE = /[\t\n\v\f\r ]+/gu;
const ANY_SPACE = /\s+/gu;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Removes only Markdown that can't be code: in a programming card a lone "**", "*" or "_" is an
 * operator or part of a name ("2 ** 3", "__init__"), so those stay as written.
 */
function repairText(text: string): string {
  const unmarked = text
    .normalize("NFC")
    .replaceAll(LINK, "$<text>")
    .replaceAll(CODE_SPAN, "$<code>")
    .replaceAll(BOLD, "$<words>");

  return replaceEmDashes(unmarked.replaceAll(LINE_SPACE, " ")).trim();
}

/** Options written twice, differing only in case or spacing, are one; it's right if either is. */
function mergeOptions(options: readonly RawOption[]): RawOption[] {
  const merged = new Map<string, RawOption>();

  for (const option of options) {
    const key = option.text.toLocaleLowerCase().replaceAll(ANY_SPACE, "");
    const kept = merged.get(key);

    merged.set(key, {
      correct: option.correct || Boolean(kept?.correct),
      text: kept?.text ?? option.text,
    });
  }

  return [...merged.values()];
}

function repairCard(card: RawWarmUpCard): RawWarmUpCard {
  return {
    options: mergeOptions(
      card.options.map((option) => ({ correct: option.correct, text: repairText(option.text) })),
    ),
    question: repairText(card.question),
    reveal: repairText(card.reveal),
  };
}

function isWritten(text: string): boolean {
  return findPlaceholderText(text).length === 0;
}

/** An answer may be only a symbol ("**", "-"), which the placeholder check reads as empty. */
function isAnswer(text: string): boolean {
  return LETTER_OR_DIGIT.test(text) ? isWritten(text) : text.length > 0;
}

function isPlayable(card: RawWarmUpCard): boolean {
  return (
    card.options.length >= MIN_OPTIONS &&
    card.options.length <= MAX_OPTIONS &&
    card.options.filter((option) => option.correct).length === 1 &&
    card.question.length <= MAX_LENGTH.question &&
    card.reveal.length <= MAX_LENGTH.reveal &&
    isWritten(card.question) &&
    isWritten(card.reveal) &&
    card.options.every((option) => option.text.length <= MAX_LENGTH.option && isAnswer(option.text))
  );
}

/**
 * A separator before exactly three digits groups thousands ("1.000", "1,000"), unless it follows a
 * lone zero ("0.125"); any other separator marks decimals.
 */
function toNumber(digits: string): number {
  const parts = digits.replace("−", "-").split(/[.,]/u);
  const last = parts.at(-1) ?? "";
  const decimal = parts.length > 1 && (last.length !== 3 || /^-?0$/u.test(parts[0] ?? ""));

  return Number(decimal ? `${parts.slice(0, -1).join("")}.${last}` : parts.join(""));
}

function readNumber(text: string): { template: string; value: number } | null {
  const numbers = text.match(NUMBER);

  return numbers?.length === 1
    ? { template: text.replaceAll(NUMBER, "#"), value: toNumber(numbers[0]) }
    : null;
}

/**
 * Writers tend to put the right answer first, so options are shuffled once. Options that differ
 * only in one number ("2", "R$ 60", "5 days") read in ascending order instead.
 */
function orderOptions({ card, id }: { card: RawWarmUpCard; id: string }): RawOption[] {
  const numbers = card.options.map((option) => readNumber(option.text));

  if (
    numbers.every((entry) => entry !== null) &&
    new Set(numbers.map((entry) => entry.template)).size === 1
  ) {
    return card.options
      .map((option, index) => ({ option, value: numbers[index]?.value ?? 0 }))
      .toSorted((first, second) => first.value - second.value)
      .map(({ option }) => option);
  }

  return seededShuffle(card.options, `${id}\n${card.question}`);
}

/**
 * The one check the pipeline and the eval scorer share: it repairs what code can and drops a card
 * it can't. A card's id is its place in the writer's list, so the same cards always get the same
 * ids and option order.
 */
export function toWarmUpCards(raw: readonly RawWarmUpCard[]): WarmUpCard[] {
  return raw.flatMap((written, index) => {
    const card = repairCard(written);

    if (!isPlayable(card)) {
      return [];
    }

    const id = String(index + 1);

    return {
      id,
      options: orderOptions({ card, id }).map((option, position) => ({
        correct: option.correct,
        id: OPTION_IDS[position] ?? String(position),
        text: option.text,
      })),
      question: card.question,
      reveal: card.reveal,
    };
  });
}
