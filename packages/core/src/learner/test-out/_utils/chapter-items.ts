import "server-only";
import { prisma } from "@zoonk/db";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { GRADABLE_ITEM_FORMATS } from "../../_utils/choice-items";
import { type GoalPlan, type GoalSkillNode } from "../../_utils/goal-skill-graph";

/** The chapter's skills inside the goal's plan, in plan order. */
export function getChapterSkills({
  chapterId,
  plan,
}: {
  chapterId: string;
  plan: GoalPlan;
}): GoalSkillNode[] {
  return plan.skills.filter((skill) => skill.areaId === chapterId);
}

/**
 * Gradable bank questions for some skills, with whether the learner has answered each before.
 * Another exam's questions stay out: general ones and the goal's exam's are asked.
 */
export async function loadSkillItems({
  examBlueprintId,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  skillIds: readonly string[];
  userId: string;
}) {
  const items = await prisma.item.findMany({
    orderBy: { id: "asc" },
    select: { format: true, id: true, skillId: true },
    where: {
      format: { in: [...GRADABLE_ITEM_FORMATS] },
      skillId: { in: [...skillIds] },
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  const answered = await prisma.attempt.findMany({
    distinct: ["itemId"],
    select: { itemId: true },
    where: { itemId: { in: items.map((item) => item.id) }, userId },
  });

  const seen = new Set(answered.map((attempt) => attempt.itemId));

  return items.map((item) => ({ ...item, seen: seen.has(item.id) }));
}
