import { MS_PER_DAY } from "@zoonk/utils/date";
import { listItemSetsForSkills } from "../../library/items/item-sets";
/** Listening-only skills without a voiced recording not heard in the last day release their reserved subject time. */
export async function loadIdleListeningSkillIds({
  examBlueprintId,
  listeningSkillIds,
  now,
  userId,
}: {
  examBlueprintId: string | null;
  listeningSkillIds: ReadonlySet<string>;
  now: Date;
  userId: string;
}): Promise<Set<string>> {
  if (listeningSkillIds.size === 0) {
    return new Set();
  }

  const sets = await listItemSetsForSkills({
    examBlueprintId,
    skillIds: [...listeningSkillIds],
    userId,
  });

  const askable = sets.filter(
    (set) =>
      set.kind === "audio" && (set.lastAnsweredAt?.getTime() ?? 0) <= now.getTime() - MS_PER_DAY,
  );

  return new Set(
    [...listeningSkillIds].filter(
      (skillId) => !askable.some((set) => set.skillIds.includes(skillId)),
    ),
  );
}
