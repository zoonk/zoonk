import "server-only";
import { prisma } from "@zoonk/db";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { INFERRED_KNOWN_ANSWER } from "../answer-rating";
import { NEW_SKILL_MEMORY, reviewSkillMemory } from "../fsrs-scheduler";
import { type GoalPlanItem } from "./goal-skill-graph";

/**
 * Records skills the learner showed they know without being asked about each one (placement or a
 * passed test-out) as one right answer now. Skills the learner is already learning keep their
 * memory: real answers outrank an inference.
 */
export async function markSkillsKnown({
  knownAt,
  skillIds,
  timeZone,
  userId,
}: {
  knownAt: Date;
  skillIds: readonly string[];
  timeZone: string;
  userId: string;
}): Promise<void> {
  if (skillIds.length === 0) {
    return;
  }

  const memory = reviewSkillMemory({
    answer: INFERRED_KNOWN_ANSWER,
    memory: NEW_SKILL_MEMORY,
    reviewedAt: knownAt,
    timeZone,
  });

  await prisma.learnerSkill.createMany({
    data: skillIds.map((skillId) => ({ ...memory, skillId, userId })),
    skipDuplicates: true,
  });

  await prisma.learnerSkill.updateMany({
    data: memory,
    where: { reps: 0, skillId: { in: [...skillIds] }, userId },
  });
}

/**
 * Marks plan items as tested out when the learner knows every skill they teach, so the plan skips
 * them. Only items still to do change; done and skipped items stay as they are. The plan then says
 * what it skipped and re-plans from today. Returns the ids.
 */
export async function markPlanItemsTestedOut({
  goalId,
  items,
  knownSkillIds,
  testedOutAt,
  timeZone,
}: {
  goalId: string;
  items: readonly GoalPlanItem[];
  knownSkillIds: ReadonlySet<string>;
  testedOutAt: Date;
  timeZone: string;
}): Promise<string[]> {
  const ids = items
    .filter(
      (item) =>
        item.status === "todo" &&
        item.skillIds.length > 0 &&
        item.skillIds.every((skillId) => knownSkillIds.has(skillId)),
    )
    .map((item) => item.id);

  if (ids.length > 0) {
    await prisma.planItem.updateMany({
      data: { completedAt: testedOutAt, status: "testedOut" },
      where: { id: { in: ids }, status: "todo" },
    });

    await announceTestedOutItems({ goalId, now: testedOutAt, planItemIds: ids, timeZone });
  }

  return ids;
}
