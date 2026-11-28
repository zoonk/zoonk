import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { loadSkillConfirmations } from "../../_utils/load-skill-claims";
import { testOutKnownPlanItems } from "../../_utils/test-out-known-plan-items";
import { SITTING_ANSWER_SQL } from "./placement-answers";
import { type PlacementAttempt } from "./placement-attempt-record";

export async function applyLegacyPlacement({
  attempt,
  goal,
  now,
  plan,
  skillIds,
  timeZone,
  today,
  tx,
}: {
  attempt: PlacementAttempt;
  goal: Goal;
  now: Date;
  plan: GoalPlan;
  skillIds: string[];
  timeZone: string;
  today: Date;
  tx: TransactionClient;
}) {
  const { id: goalId, userId } = goal;
  const { id: attemptId } = attempt;

  await tx.$executeRaw`
    UPDATE attempts SET answer = answer - 'placementPending'
    WHERE user_id = ${userId}::uuid AND focus_test_id = ${attemptId}::uuid AND ${SITTING_ANSWER_SQL}
      AND answer @> '{"placementPending":true}'::jsonb
  `;

  const { confirmed, heldUntilTomorrow } = await loadSkillConfirmations({
    goalId,
    skillIds,
    timeZone,
    today,
    tx,
    userId,
  });

  const changed = await testOutKnownPlanItems(tx, {
    goalId,
    items: plan.items,
    knownSkillIds: confirmed,
    placedSkills: plan.skills.filter((skill) => attempt.skillIds.includes(skill.id)),
    testedOutAt: now,
    timeZone,
  });

  const testedOutPlanItemIds = [...changed.itemIds, ...changed.standInIds];

  const partLessonsSkipped = countLessons(
    testedOutPlanItemIds.length > 0
      ? await tx.planItem.findMany({
          select: { chapterId: true, kind: true, lessonId: true, lessons: true, skillId: true },
          where: { id: { in: testedOutPlanItemIds } },
        })
      : [],
  );

  return {
    confirmed,
    heldUntilTomorrow,
    partLessonsSkipped,
    sharedItemIds: changed.sharedItemIds,
    testedOutPlanItemIds,
  };
}
