import "server-only";
import { prisma } from "@zoonk/db";
import { isDrillQuestion, listDrillableMistakes } from "../exams/listening/listening-skills";
import { GRADABLE_ITEM_FORMATS, parseChoiceItem } from "../learner/_utils/choice-items";
import { getItemAudienceFilter } from "../library/items/item-field";
import { isMistakeSkill } from "./mistake-drills";

/** Uses the same material eligibility as mistake practice, including owning goal-skill questions. */
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
  const skillIds = [...new Set(drillable.flatMap((mistake) => mistake.skillId ?? []))];

  if (skillIds.length === 0) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: {
      format: { in: [...GRADABLE_ITEM_FORMATS] },
      skillId: { in: [...new Set(skillIds.flatMap((id) => [id, ownerOf.get(id) ?? id]))] },
      ...getItemAudienceFilter({
        examBlueprintId,
        field,
        keepIds: drillable.flatMap((mistake) => mistake.itemId ?? []),
      }),
    },
  });

  const choices = items.map((item) => parseChoiceItem(item)).filter((item) => item !== null);

  return drillable.filter((mistake) =>
    choices.some(
      (item) =>
        isMistakeSkill({ itemSkillId: item.skillId, mistakeSkillId: mistake.skillId, ownerOf }) &&
        isDrillQuestion({ item, listeningSkillIds, mistakeItemId: mistake.itemId }),
    ),
  );
}
