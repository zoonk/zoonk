import { type ItemFormat } from "@zoonk/db";
import { type PlacementQuickFormat, getQuickFormatOrder } from "./placement-quick-format";

export type PlacementItemCandidate = {
  /** The item bank's difficulty (easy -1, medium 0, hard 1); unknown reads as medium. */
  difficulty?: number | null;
  format: ItemFormat;
  id: string;
  seen: boolean;
  skillId: string;
};

const CONFIRMING_FORMATS: readonly ItemFormat[] = ["typed", "numeric", "spoken"];

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
          getFormatRank({ confirming, format: a.format, quickFormat }) -
            getFormatRank({ confirming, format: b.format, quickFormat }) ||
          getDifficultyGap({ item: a, target: targetDifficulty }) -
            getDifficultyGap({ item: b, target: targetDifficulty }),
      )[0] ?? null
  );
}
