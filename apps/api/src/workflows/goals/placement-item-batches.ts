import { type PlacementItemPick } from "@zoonk/core/lookahead/placement-item-skills";
import { splitEvenly } from "@zoonk/utils/split-evenly";

/** Small calls keep the first question from waiting on a long output; batching avoids repeated instructions. */
const ITEMS_PER_CALL = 2;

type BatchedPick = Pick<PlacementItemPick, "country" | "needsQuick" | "ownerId" | "tapsNeeded">;

/** How many questions of each kind one call writes for a skill. */
export type PlacementSkillWrite<TSkill> = TSkill & { quickCount: number; tapCount: number };

function toWrite<TSkill extends BatchedPick>({
  quickCount,
  skill,
}: {
  quickCount: number;
  skill: TSkill;
}): PlacementSkillWrite<TSkill> {
  return { ...skill, quickCount: skill.needsQuick ? quickCount : 0, tapCount: skill.tapsNeeded };
}

/**
 * The first pick is the first question placement asks, so its quick questions get the shortest
 * call, of their own; its tap questions are written beside them, in a call of their own.
 */
function splitFirst<TSkill>(first: PlacementSkillWrite<TSkill>): PlacementSkillWrite<TSkill>[][] {
  if (first.quickCount === 0 || first.tapCount === 0) {
    return [[first]];
  }

  return [[{ ...first, tapCount: 0 }], [{ ...first, quickCount: 0 }]];
}

export function toPlacementItemBatches<TSkill extends BatchedPick>({
  quickCount,
  skills,
}: {
  /** Quick questions a skill that needs them gets, confirming ones included. */
  quickCount: number;
  skills: readonly TSkill[];
}): PlacementSkillWrite<TSkill>[][] {
  const [first, ...rest] = skills.map((skill) => toWrite({ quickCount, skill }));

  if (!first) {
    return [];
  }

  const groups = Map.groupBy(rest, (skill) => JSON.stringify([skill.country, skill.ownerId]));

  return [
    ...splitFirst(first),
    ...[...groups.values()].flatMap((items) => {
      const largest = Math.max(...items.map((skill) => skill.quickCount + skill.tapCount));
      return splitEvenly({ items, size: Math.max(1, Math.floor(ITEMS_PER_CALL / largest)) });
    }),
  ];
}
