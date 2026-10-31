import { type PlacementItemPick } from "@zoonk/core/lookahead/placement-item-skills";
import { splitEvenly } from "@zoonk/utils/split-evenly";

/** Small calls keep the first question from waiting on a long output; batching avoids repeated instructions. */
const QUICK_ITEMS_PER_CALL = 2;

/** The first pick is the first question placement asks, so it gets the shortest call, of its own. */
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
