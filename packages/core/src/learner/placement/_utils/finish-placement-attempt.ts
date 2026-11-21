import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { owePlanStartLessons } from "../../../follow-ups/owe-goal-lessons";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { announceSharedTestOuts } from "../../../plans/announce-shared-test-outs";
import { announceTestedOutItems } from "../../../plans/announce-tested-out-items";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { loadConfirmedSkills } from "../../_utils/load-skill-claims";
import { testOutKnownPlanItems } from "../../_utils/test-out-known-plan-items";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { type PlacementCompletion } from "./complete-placement";
import { loadPlacementWithSummary } from "./load-placement-state";
import { SITTING_ANSWER_SQL } from "./placement-answers";
import { savePlacementAttempt } from "./placement-attempt";
import { readPlacementAttempt } from "./placement-attempt-record";

export async function finishPlacementAttempt({
  attemptId,
  goal,
  part = 1,
  timeZone,
}: {
  attemptId: string;
  goal: Goal;
  part?: number;
  timeZone: string;
}): Promise<PlacementCompletion | null> {
  const { id: goalId, userId } = goal;
  const now = new Date();
  const today = getDateInTimeZone({ date: now, timeZone });

  const saved = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId },
    async (tx) => {
      const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
      const record = readPlacementAttempt(current);
      const { attempt, lastPart } = record;

      if (attempt && attempt.id !== attemptId) {
        return unchanged(null);
      }

      if (lastPart?.attemptId === attemptId && lastPart.part === part) {
        return unchanged(lastPart);
      }

      if (attempt?.id !== attemptId || attempt.part !== part || attempt.partComplete) {
        return unchanged(null);
      }

      const plan = await loadPlacementPlan(goalId, tx);

      const { attemptFollowUps, attemptHasMore, state } = await loadPlacementWithSummary({
        goalId,
        plan,
        timeZone,
        today,
        tx,
        userId,
      });

      await tx.$executeRaw`
      UPDATE attempts SET answer = answer - 'placementPending'
      WHERE user_id = ${userId}::uuid AND focus_test_id = ${attemptId}::uuid AND ${SITTING_ANSWER_SQL}
    `;

      const confirmed = await loadConfirmedSkills({
        goalId,
        skillIds: state.knownSkillIds,
        timeZone,
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

      const lessonsSkipped = attempt.lessonsSkipped + partLessonsSkipped;
      const finishedAt = now.toISOString();

      const receipt = {
        attemptId,
        finishedAt,
        knownSkillIds: [...confirmed],
        lessonsSkipped: partLessonsSkipped,
        part,
        testedOutPlanItemIds,
      };

      const canContinue = attempt.length === "wholeCourse" && attemptHasMore;

      await savePlacementAttempt({
        goal: current,
        record: {
          ...record,
          attempt: canContinue
            ? {
                ...attempt,
                estimatedMinutes: state.attempt?.estimatedMinutes ?? attempt.estimatedMinutes,
                lessonsSkipped,
                partComplete: true,
              }
            : null,
          lastPart: receipt,
          ...(attempt.length === "quick" && { quickFollowUpSkillIds: attemptFollowUps ?? [] }),
          result: canContinue ? record.result : { attemptId, finishedAt, lessonsSkipped },
        },
        tx,
      });

      await owePlanStartLessons({ db: tx, goalId, userId });

      return receipt;
    },
  );

  if (!saved) {
    return null;
  }

  const testedOutAt = new Date(saved.finishedAt);
  await announceSharedTestOuts({ goalId, now: testedOutAt, testedOutAt, userId });

  await announceTestedOutItems({
    goalId,
    mergeWithUnseen: false,
    now: testedOutAt,
    planItemIds: saved.testedOutPlanItemIds,
    timeZone,
  });

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  const plan = await loadPlacementPlan(goalId);
  const { state } = await loadPlacementWithSummary({ goalId, plan, timeZone, today, userId });

  return {
    areas: state.areas,
    attempt: state.attempt,
    complete: !state.attempt,
    focusTest: null,
    knownSkillIds: saved.knownSkillIds,
    partLessonsSkipped: saved.lessonsSkipped,
    phases: state.phases,
    result: state.result,
    testedOutPlanItemIds: saved.testedOutPlanItemIds,
  };
}
