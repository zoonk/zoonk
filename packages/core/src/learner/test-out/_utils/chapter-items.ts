import "server-only";
import { prisma } from "@zoonk/db";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { GRADABLE_ITEM_FORMATS } from "../../_utils/choice-items";
import { type GoalSkillNode } from "../../_utils/goal-skill-graph";
import { type TestOutPlan } from "./test-out-plan";

/** Returns skills in plan order; a shared skill can be tested from any chapter teaching it. */
export function getChapterSkills({
  chapterId,
  plan,
}: {
  chapterId: string;
  plan: TestOutPlan;
}): TestOutPlan["skills"] {
  const taught = new Set(
    plan.items.filter((item) => item.chapterId === chapterId).flatMap((item) => item.skillIds),
  );

  return plan.skills.filter((skill) => skill.areaId === chapterId || taught.has(skill.id));
}

/** Counts todo lessons teaching only these skills, even when placed in other chapters. */
export function countSkippableItems({
  plan,
  skills,
}: {
  plan: TestOutPlan;
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

/** Includes general and matching-exam questions, never another exam's. */
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
