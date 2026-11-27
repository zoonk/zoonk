import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type MatchTry } from "@zoonk/learn/use-match-board";
import { type MatchCard } from "./match-pairs-columns";

type Columns = { left: readonly MatchCard[]; right: readonly MatchCard[] };

/** For each left card, the right card it was first tried with: its partner, or the first miss. */
export function matchAnswer(
  { left, right }: Columns,
  misses: readonly MatchTry[],
): Extract<ActivityAnswer, { kind: "assignment" }> {
  return {
    kind: "assignment",
    pairs: Object.fromEntries(
      left.map((card, index) => {
        const first = misses.find((miss) => miss.left === index);
        return [card.id, (first && right[first.right]?.id) ?? card.id];
      }),
    ),
  };
}

/**
 * The finished board an answer stands for, and each left card's first wrong try. A first try at a
 * card the activity no longer has, from before its unpaired cards were removed, can't be named.
 */
export function boardFromAnswer(
  { left, right }: Columns,
  answer: ActivityAnswer | null,
): { misses: MatchTry[]; pairs: number[] } | undefined {
  if (answer?.kind !== "assignment") {
    return undefined;
  }

  const placeOf = (id: string | undefined) => right.findIndex((card) => card.id === id);

  return {
    misses: left.flatMap((card, index) => {
      const tried = placeOf(answer.pairs[card.id]);
      return tried >= 0 && right[tried]?.id !== card.id ? [{ left: index, right: tried }] : [];
    }),
    pairs: left.map((card) => placeOf(card.id)),
  };
}
