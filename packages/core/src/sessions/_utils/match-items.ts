import { type Item } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { parseItemContent } from "../../library/items/item-content";
import { type MatchAnswer, type QuestionAnswer } from "../contract";
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

type ShownMatch = { blockId: string; item: MatchItem };

/** Each block shows its own order, so a returning board tests the pairs rather than their places. */
function getRightOrder({ blockId, item }: ShownMatch): number[] {
  return getShownOrder({ count: item.content.pairs.length, seed: `${blockId}:${item.id}` });
}

export function getMatchKey({ blockId, item }: ShownMatch): number[] {
  const order = getRightOrder({ blockId, item });
  return item.content.pairs.map((_, index) => order.indexOf(index));
}

/** Shuffles the right column and omits the correct pairing. */
export function toMatchQuestion({ blockId, item }: ShownMatch) {
  const pairs = item.content.pairs;

  return {
    context: null,
    format: item.format,
    image: null,
    itemId: item.id,
    left: pairs.map((pair) => pair.left),
    options: null,
    question: item.content.question,
    right: getRightOrder({ blockId, item }).map((index) => pairs[index]?.right ?? ""),
    skillId: item.skillId,
    visual: null,
  };
}

function describePairs({ item, rights }: { item: MatchItem; rights: readonly number[] }) {
  return item.content.pairs
    .map((pair, index) => `${pair.left} → ${item.content.pairs[rights[index] ?? -1]?.right ?? "?"}`)
    .join("; ");
}

function describeMisses({
  item,
  misses,
  order,
}: {
  item: MatchItem;
  misses: NonNullable<MatchAnswer["misses"]>;
  order: readonly number[];
}) {
  return misses
    .flatMap((miss) => {
      const left = item.content.pairs[miss.left];
      const rightIndex = order[miss.right];
      const right = item.content.pairs[rightIndex ?? -1];
      return left && right && miss.left !== rightIndex ? [`${left.left} → ${right.right}`] : [];
    })
    .join("; ");
}

function describeMatchAnswer({
  answer,
  item,
  order,
  picks,
}: {
  answer: QuestionAnswer;
  item: MatchItem;
  order: readonly number[];
  picks: readonly number[];
}) {
  if ("matches" in answer && answer.misses !== undefined) {
    return describeMisses({ item, misses: answer.misses, order }) || null;
  }

  return picks.length > 0 ? describePairs({ item, rights: picks }) : null;
}

/** Grade indexes against the displayed column order; mismatched answer shapes count as wrong. */
export function gradeMatch({ answer, blockId, item }: ShownMatch & { answer: QuestionAnswer }) {
  const order = getRightOrder({ blockId, item });
  const picks = "matches" in answer ? answer.matches.map((shown) => order[shown] ?? -1) : [];

  const isCorrect =
    "matches" in answer &&
    (answer.misses?.length ?? 0) === 0 &&
    picks.length === item.content.pairs.length &&
    picks.every((pick, index) => pick === index);

  return {
    correctAnswer: { matches: getMatchKey({ blockId, item }) },
    explanation: item.content.reason,
    isCorrect,
    recorded: answer,
    snapshot: {
      answer: describeMatchAnswer({ answer, item, order, picks }),
      correctAnswer: describePairs({ item, rights: order.map((_, index) => index) }),
      explanation: item.content.reason,
      format: item.format,
      misconception: null,
      question: item.content.question,
      replay: { item, kind: "item" as const },
    },
    workedSteps: [] as string[],
  };
}
