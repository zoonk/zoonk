import { type PlacementItemPick } from "@zoonk/core/lookahead/placement-item-skills";
import { splitEvenly } from "@zoonk/utils/split-evenly";

/**
 * Smaller calls keep the learner's first question from waiting on a long output, while batching
 * skills avoids repeating the same instructions for every skill.
 */
const QUICK_ITEMS_PER_CALL = 2;

/**
 * Placement's picked skills in the batches one model call writes, in pick order: skills that need
 * the same questions (a language goal's typed one too, or only quick ones) and whose content has
 * the same owner (a private course's or shared), as many per call as `quickCount` quick questions
 * each allow.
 * The first pick is the first question placement asks, so it gets the shortest call, of its own.
 */
export function toPlacementItemBatches<
  TSkill extends Pick<PlacementItemPick, "needsTyped" | "ownerId">,
>({ quickCount, skills }: { quickCount: number; skills: readonly TSkill[] }): TSkill[][] {
  const [first, ...rest] = skills;

  if (!first) {
    return [];
  }

  const size = Math.max(1, Math.floor(QUICK_ITEMS_PER_CALL / quickCount));
  const groups = Map.groupBy(rest, (skill) => JSON.stringify([skill.ownerId, skill.needsTyped]));

  return [[first], ...[...groups.values()].flatMap((items) => splitEvenly({ items, size }))];
}
