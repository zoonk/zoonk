import { type Item } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { parseItemContent } from "../../library/items/item-content";
import { type QuestionAnswer } from "../contract";
import { getShownOrder } from "./shown-order";

type MatchPairsContent = Extract<
  ReturnType<typeof parseItemContent>,
  { format: "matchPairs" }
>["content"];

export type MatchItem = Pick<Item, "id" | "language" | "skillId"> & {
  content: MatchPairsContent;
  format: "matchPairs";
};

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

export function parseMatchItem(item: BankItem): MatchItem | null {
  try {
    const parsed = parseItemContent({ content: item.content, format: "matchPairs" });

    return parsed.format === "matchPairs"
      ? { ...parsed, id: item.id, language: item.language, skillId: item.skillId }
      : null;
  } catch (error) {
    logError(`Item ${item.id} has content that doesn't match its format.`, error);
    return null;
  }
}

function getRightOrder(item: MatchItem): number[] {
  return getShownOrder({ count: item.content.pairs.length, seed: item.id });
}

/** Shuffles the right column and omits the correct pairing. */
export function toMatchQuestion(item: MatchItem) {
  const pairs = item.content.pairs;

  return {
    context: null,
    format: item.format,
    image: null,
    itemId: item.id,
    left: pairs.map((pair) => pair.left),
    options: null,
    question: item.content.question,
    right: getRightOrder(item).map((index) => pairs[index]?.right ?? ""),
    skillId: item.skillId,
    unit: null,
    visual: null,
  };
}

function describePairs({ item, rights }: { item: MatchItem; rights: readonly number[] }) {
  return item.content.pairs
    .map((pair, index) => `${pair.left} → ${item.content.pairs[rights[index] ?? -1]?.right ?? "?"}`)
    .join("; ");
}

/** Grade indexes against the displayed column order; mismatched answer shapes count as wrong. */
export function gradeMatch({ answer, item }: { answer: QuestionAnswer; item: MatchItem }) {
  const order = getRightOrder(item);
  const picks = "matches" in answer ? answer.matches.map((shown) => order[shown] ?? -1) : [];

  const isCorrect =
    picks.length === item.content.pairs.length && picks.every((pick, index) => pick === index);

  return {
    correctAnswer: { matches: item.content.pairs.map((_, index) => order.indexOf(index)) },
    explanation: item.content.reason,
    isCorrect,
    recorded: answer,
    snapshot: {
      answer: picks.length > 0 ? describePairs({ item, rights: picks }) : null,
      correctAnswer: describePairs({ item, rights: order.map((_, index) => index) }),
      explanation: item.content.reason,
      format: item.format,
      misconception: null,
      question: item.content.question,
    },
    workedSteps: [] as string[],
  };
}
