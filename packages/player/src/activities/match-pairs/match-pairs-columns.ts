import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { seededShuffle } from "@zoonk/utils/seeded-random";

type MatchFields = Pick<ActivityContentFor<"matchPairs">["fields"], "pairs">;

export type MatchCard = { id: string; text: string; why: string | null };

const MAX_ATTEMPTS = 32;

function sideCards(fields: MatchFields, side: "left" | "right"): MatchCard[] {
  return fields.pairs.map((pair) => ({ id: pair.id, text: pair[side], why: pair.why ?? null }));
}

function hasAlignedPair(left: readonly MatchCard[], right: readonly MatchCard[]): boolean {
  return left.some((card, index) => right[index]?.id === card.id);
}

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
