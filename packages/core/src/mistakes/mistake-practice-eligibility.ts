import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { listDrillableMistakes } from "../exams/listening/listening-skills";
import { GRADABLE_ITEM_FORMATS } from "../learner/_utils/choice-items";
import { IN_BANK, getGoalField, getItemAudienceFilter } from "../library/items/item-field";

export type PracticeMistake = { createdAt: Date; id: string; skillId: string | null };

/**
 * Uses the same material eligibility as mistake practice, including owning goal-skill questions: a
 * listening skill's only question is the mistake's own recorded item. A mistake's own question
 * counts for that mistake only, so the result doesn't depend on which mistakes are checked together.
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

  const mistakeSkills = (mistake: TMistake) =>
    mistake.skillId ? [mistake.skillId, ownerOf.get(mistake.skillId) ?? mistake.skillId] : [];

  const candidateSkillIds = [...new Set(drillable.flatMap((mistake) => mistakeSkills(mistake)))];

  if (candidateSkillIds.length === 0) {
    return [];
  }

  const formats = [...GRADABLE_ITEM_FORMATS];

  const withQuestions = await prisma.item.groupBy({
    by: ["skillId"],
    where: {
      format: { in: formats },
      skillId: { in: candidateSkillIds.filter((id) => !listeningSkillIds.has(id)) },
      ...getItemAudienceFilter({ examBlueprintId, field }),
    },
  });

  const skillsWithQuestions = new Set(withQuestions.map((group) => group.skillId));

  const hasSkillQuestions = (mistake: TMistake) =>
    mistakeSkills(mistake).some((skillId) => skillsWithQuestions.has(skillId));

  const ownItemIds = drillable.flatMap((mistake) =>
    mistake.itemId && !hasSkillQuestions(mistake) ? [mistake.itemId] : [],
  );

  const ownItems =
    ownItemIds.length > 0
      ? await prisma.item.findMany({
          select: { id: true, skillId: true },
          where: { ...IN_BANK, format: { in: formats }, id: { in: ownItemIds } },
        })
      : [];

  const ownSkill = new Map(ownItems.map((item) => [item.id, item.skillId]));

  function hasOwnQuestion(mistake: TMistake): boolean {
    const own = mistake.itemId ? ownSkill.get(mistake.itemId) : undefined;
    return own !== undefined && mistakeSkills(mistake).includes(own);
  }

  return drillable.filter((mistake) => hasSkillQuestions(mistake) || hasOwnQuestion(mistake));
}

/** The open mistakes on the goal's skills that have practice material, oldest first. */
export async function loadPracticeMistakes({
  goal,
  listeningSkillIds,
  ownerOf,
  userId,
}: {
  goal: Pick<Goal, "details" | "examBlueprintId">;
  listeningSkillIds: ReadonlySet<string>;
  ownerOf: ReadonlyMap<string, string>;
  userId: string;
}): Promise<PracticeMistake[]> {
  const mistakes = await prisma.mistake.findMany({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, id: true, itemId: true, skillId: true },
    where: { skillId: { in: [...ownerOf.keys()] }, status: "open", userId },
  });

  const eligible = await filterMistakesWithPracticeMaterial({
    examBlueprintId: goal.examBlueprintId,
    field: getGoalField(goal.details),
    listeningSkillIds,
    mistakes,
    ownerOf,
  });

  return eligible.map(({ createdAt, id, skillId }) => ({ createdAt, id, skillId }));
}
