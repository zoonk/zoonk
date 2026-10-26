import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { seededShuffle } from "@zoonk/utils/seeded-random";

type MatchFields = ActivityContentFor<"matchPairs">["fields"];

/** One card in a column. A pair's two cards share its id, so both columns hold the same pairs. */
export type MatchCard = { id: string; text: string; why: string | null };

const MAX_ATTEMPTS = 32;

function sideCards(fields: MatchFields, side: "left" | "right"): MatchCard[] {
  return fields.pairs.map((pair) => ({
    id: pair.id,
    text: side === "left" ? pair.left : pair.right,
    why: pair.why ?? null,
  }));
}

function hasAlignedPair(left: readonly MatchCard[], right: readonly MatchCard[]): boolean {
  return left.some((card, index) => right[index]?.id === card.id);
}

/**
 * Both columns in a shuffled order that's the same on every load, with no pair sitting side by
 * side, since a lined-up pair gives its answer away. The right column tries seeds until none
 * lines up, which takes one or two tries even with two pairs.
 */
export function arrangeMatchColumns(fields: MatchFields): {
  left: MatchCard[];
  right: MatchCard[];
} {
  const seed = fields.pairs.map((pair) => pair.id).join(" ");
  const left = seededShuffle(sideCards(fields, "left"), `left ${seed}`);
  const rightCards = sideCards(fields, "right");

  const candidates = Array.from({ length: MAX_ATTEMPTS }, (_, attempt) =>
    seededShuffle(rightCards, `right ${attempt} ${seed}`),
  );

  const right = candidates.find((candidate) => !hasAlignedPair(left, candidate)) ?? rightCards;

  return { left, right };
}
