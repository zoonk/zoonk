import { type ItemFormat } from "@zoonk/db";
import { isLowGuessTap } from "../_utils/placement-guess-rate";
import { type PlacementQuickFormat, getQuickFormatOrder } from "./placement-quick-format";

export type PlacementItemCandidate = {
  /** The item bank's difficulty (easy -1, medium 0, hard 1); unknown reads as medium. */
  content?: unknown;
  difficulty?: number | null;
  format: ItemFormat;
  id: string;
  seen: boolean;
  skillId: string;
};

function getFormatRank({
  confirming,
  item,
  quickFormat,
}: {
  confirming: boolean;
  item: PlacementItemCandidate;
  quickFormat: PlacementQuickFormat;
}) {
  const lowGuess = isLowGuessTap(item);

  if (lowGuess) {
    return confirming ? 0 : 3;
  }

  const quick = getQuickFormatOrder(quickFormat);
  const index = quick.indexOf(item.format);
  return index === -1 ? 3 : index + 1;
}

function getDifficultyGap({ item, target }: { item: PlacementItemCandidate; target: number }) {
  return Math.abs((item.difficulty ?? 0) - target);
}

/** Chooses only unseen questions, prioritizing hard-to-guess formats for confirmation. */
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
          getFormatRank({ confirming, item: a, quickFormat }) -
            getFormatRank({ confirming, item: b, quickFormat }) ||
          getDifficultyGap({ item: a, target: targetDifficulty }) -
            getDifficultyGap({ item: b, target: targetDifficulty }),
      )[0] ?? null
  );
}
