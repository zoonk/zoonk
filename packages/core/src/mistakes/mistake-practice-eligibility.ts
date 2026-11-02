import "server-only";
import { prisma } from "@zoonk/db";
import { listDrillableMistakes } from "../exams/listening/listening-skills";
import { GRADABLE_ITEM_FORMATS } from "../learner/_utils/choice-items";
import { getItemAudienceFilter } from "../library/items/item-field";

/**
 * Uses the same material eligibility as mistake practice, including owning goal-skill questions: a
 * listening skill's only question is the mistake's own recorded item.
 */
export async function filterMistakesWithPracticeMaterial<
  TMistake extends { itemId: string | null; skillId: string | null },
>({
  examBlueprintId,
  field,
  listeningSkillIds,
  mistakes,
  ownerOf,
}: {
  examBlueprintId: string | null;
  field: string | null;
  listeningSkillIds: ReadonlySet<string>;
  mistakes: readonly TMistake[];
  ownerOf: ReadonlyMap<string, string>;
}): Promise<TMistake[]> {
  const drillable = await listDrillableMistakes({ listeningSkillIds, mistakes });
  const mistakeSkills = (skillId: string) => [skillId, ownerOf.get(skillId) ?? skillId];
  const skillIds = [...new Set(drillable.flatMap((mistake) => mistake.skillId ?? []))];

  if (skillIds.length === 0) {
    return [];
  }

  const itemIds = drillable.flatMap((mistake) => mistake.itemId ?? []);
  const formats = [...GRADABLE_ITEM_FORMATS];

  const candidateSkillIds = [...new Set(skillIds.flatMap((id) => mistakeSkills(id)))].filter(
    (id) => !listeningSkillIds.has(id),
  );

  const heardItemIds = drillable.flatMap((mistake) =>
    mistake.itemId &&
    mistake.skillId &&
    mistakeSkills(mistake.skillId).some((id) => listeningSkillIds.has(id))
      ? [mistake.itemId]
      : [],
  );

  const [withQuestions, ownItems] = await Promise.all([
    prisma.item.groupBy({
      by: ["skillId"],
      where: {
        format: { in: formats },
        skillId: { in: candidateSkillIds },
        ...getItemAudienceFilter({ examBlueprintId, field, keepIds: itemIds }),
      },
    }),
    heardItemIds.length > 0
      ? prisma.item.findMany({
          select: { id: true, skillId: true },
          where: { format: { in: formats }, id: { in: heardItemIds } },
        })
      : [],
  ]);

  const skillsWithQuestions = new Set(withQuestions.map((group) => group.skillId));
  const ownSkill = new Map(ownItems.map((item) => [item.id, item.skillId]));

  function hasQuestions(mistake: TMistake): boolean {
    const skills = mistake.skillId ? mistakeSkills(mistake.skillId) : [];
    const own = mistake.itemId ? ownSkill.get(mistake.itemId) : undefined;

    return (
      skills.some((skillId) => skillsWithQuestions.has(skillId)) ||
      (own !== undefined && skills.includes(own))
    );
  }

  return drillable.filter((mistake) => hasQuestions(mistake));
}
