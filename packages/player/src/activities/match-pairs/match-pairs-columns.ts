import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { seededShuffle } from "@zoonk/utils/seeded-random";

type MatchFields = ActivityContentFor<"matchPairs">["fields"];

/** One card in a column. Pair cards share their pair's id on both sides; traps have their own. */
export type MatchCard = { id: string; isTrap: boolean; text: string; why: string | null };

const MAX_ATTEMPTS = 32;

function sideCards(fields: MatchFields, side: "left" | "right"): MatchCard[] {
  const pairs = fields.pairs.map((pair) => ({
    id: pair.id,
    isTrap: false,
    text: side === "left" ? pair.left : pair.right,
    why: pair.why ?? null,
  }));

  const traps = fields.distractors
    .filter((distractor) => distractor.side === side)
    .map((distractor, index) => ({
      id: `${side}-trap-${index}`,
      isTrap: true,
      text: distractor.text,
      why: distractor.why,
    }));

  return [...pairs, ...traps];
}

function hasAlignedPair(left: readonly MatchCard[], right: readonly MatchCard[]): boolean {
  return left.some((card, index) => !card.isTrap && right[index]?.id === card.id);
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

/**
 * Why two cards don't go together, from the writer's notes: the trap among them (the right one
 * first) with its own reason, or else the reason on the pairs the learner mixed up.
 */
export function explainMismatch({ left, right }: { left: MatchCard; right: MatchCard }): {
  reason: string | null;
  trap: MatchCard | null;
} {
  const trap = [right, left].find((card) => card.isTrap) ?? null;
  return { reason: trap?.why ?? right.why ?? left.why, trap };
}
