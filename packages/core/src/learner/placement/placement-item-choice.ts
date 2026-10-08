import { type ItemFormat } from "@zoonk/db";
import { type PlacementQuickFormat, getQuickFormatOrder } from "./placement-quick-format";

/** A question from the shared item bank that placement could ask. */
export type PlacementItemCandidate = {
  /** The item bank's difficulty (easy -1, medium 0, hard 1); unknown reads as medium. */
  difficulty?: number | null;
  format: ItemFormat;
  id: string;
  seen: boolean;
  skillId: string;
};

const CONFIRMING_FORMATS: readonly ItemFormat[] = ["typed", "numeric", "spoken"];

/**
 * Where a format ranks for the next question, 0 first: the goal's quick format to cover breadth;
 * formats a guess can't pass to confirm, then the quick ones in the goal's order.
 */
function getFormatRank({
  confirming,
  format,
  quickFormat,
}: {
  confirming: boolean;
  format: ItemFormat;
  quickFormat: PlacementQuickFormat;
}) {
  const quick = getQuickFormatOrder(quickFormat);
  const preferred = confirming ? [...CONFIRMING_FORMATS, ...quick] : quick;
  const index = preferred.indexOf(format);

  return index === -1 ? preferred.length : index;
}

function getDifficultyGap({ item, target }: { item: PlacementItemCandidate; target: number }) {
  return Math.abs((item.difficulty ?? 0) - target);
}

/**
 * Picks an unseen question for a skill: a quick one in the goal's quick format to cover breadth the
 * first time (`quickFormat`: an exam that judges assertions asks true or false), and a typed or
 * numeric one to confirm a skill the learner already got right, since those are hard to guess.
 * Among those, the one closest to `targetDifficulty` (see `getTargetDifficulty`).
 */
export function pickPlacementItem({
  confirming,
  items,
  quickFormat = "multipleChoice",
  skillId,
  targetDifficulty = 0,
}: {
  confirming: boolean;
  items: readonly PlacementItemCandidate[];
  quickFormat?: PlacementQuickFormat;
  skillId: string;
  targetDifficulty?: number;
}): PlacementItemCandidate | null {
  return (
    items
      .filter((item) => item.skillId === skillId && !item.seen)
      .toSorted(
        (a, b) =>
          getFormatRank({ confirming, format: a.format, quickFormat }) -
            getFormatRank({ confirming, format: b.format, quickFormat }) ||
          getDifficultyGap({ item: a, target: targetDifficulty }) -
            getDifficultyGap({ item: b, target: targetDifficulty }),
      )[0] ?? null
  );
}
