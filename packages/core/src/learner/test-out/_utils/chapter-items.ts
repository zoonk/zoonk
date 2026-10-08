import "server-only";
import { prisma } from "@zoonk/db";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { GRADABLE_ITEM_FORMATS } from "../../_utils/choice-items";
import { type GoalPlan, type GoalSkillNode } from "../../_utils/goal-skill-graph";

/**
 * The chapter's skills inside the goal's plan, in plan order: the skills whose area it is and the
 * ones its planned lessons teach, so a skill whose lessons span several chapters can be tested
 * out from any of them.
 */
export function getChapterSkills({
  chapterId,
  plan,
}: {
  chapterId: string;
  plan: GoalPlan;
}): GoalSkillNode[] {
  const taught = new Set(
    plan.items.filter((item) => item.chapterId === chapterId).flatMap((item) => item.skillIds),
  );

  return plan.skills.filter((skill) => skill.areaId === chapterId || taught.has(skill.id));
}

/**
 * The plan's lessons still to do that a pass on these skills would skip: the ones teaching only
 * them, wherever the plan has them.
 */
export function countSkippableItems({
  plan,
  skills,
}: {
  plan: GoalPlan;
  skills: readonly Pick<GoalSkillNode, "id">[];
}): number {
  const ids = new Set(skills.map((skill) => skill.id));

  return plan.items.filter(
    (item) =>
      item.status === "todo" &&
      item.skillIds.length > 0 &&
      item.skillIds.every((skillId) => ids.has(skillId)),
  ).length;
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
