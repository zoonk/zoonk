import { type ItemFormat } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

const MAX_LOW_GUESS_RATE = 0.05;

/** Right low-guess answers a topic needs, beside a right quick one, before its lessons are skipped. */
export const LOW_GUESS_ANSWERS_TO_SKIP = 3;

const DEFAULT_GUESS_RATES: Readonly<Record<ItemFormat, number>> = {
  essay: 0.05,
  matchPairs: 1,
  multipleChoice: 0.25,
  numeric: 0.02,
  order: 1,
  spoken: 0.05,
  trueFalse: 0.5,
  typed: 0.02,
};

function countOptions(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function guessPermutation(count: number): number {
  return count > 1 ? guessPermutation(count - 1) / count : 1;
}

export function getPlacementGuessRate({
  content,
  format,
}: {
  content?: unknown;
  format: ItemFormat;
}): number {
  if (!isJsonObject(content)) {
    return DEFAULT_GUESS_RATES[format];
  }

  if (format === "matchPairs") {
    return guessPermutation(countOptions(content.pairs));
  }

  if (format === "order") {
    return guessPermutation(countOptions(content.steps));
  }

  if (format === "multipleChoice" && content.select === "all") {
    return 2 ** -countOptions(content.options);
  }

  return DEFAULT_GUESS_RATES[format];
}

export function isLowGuessTap(item: { format: ItemFormat; content?: unknown }): boolean {
  const { format, content } = item;

  return (
    (format === "matchPairs" ||
      format === "order" ||
      (format === "multipleChoice" && isJsonObject(content) && content.select === "all")) &&
    getPlacementGuessRate(item) <= MAX_LOW_GUESS_RATE
  );
}

export function isQuickChoice({
  content,
  format,
}: {
  content?: unknown;
  format: ItemFormat;
}): boolean {
  return format === "multipleChoice" && (!isJsonObject(content) || (content.select ?? 1) === 1);
}
