import "server-only";
import { type Goal } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { owePlanStartLessons } from "../../../follow-ups/owe-goal-lessons";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { recordTestOutChange } from "../../../plans/record-test-out-change";
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

  const receiptKey = placementPartReceipt(attemptId, part);

  const saved = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    const record = readPlacementAttempt(current);
    const { attempt, finishedParts, result } = record;

    if ((attempt?.id ?? result?.attemptId) !== attemptId) {
      return unchanged(null);
    }

    const finishedPart = finishedParts.find((finished) => finished.part === part);

    if (finishedPart) {
      return unchanged(finishedPart);
    }

    if (attempt?.id !== attemptId || attempt.part !== part || attempt.partComplete) {
      return unchanged(null);
    }

    const plan = await loadPlacementPlan(goalId, tx);

    const { attemptFollowUps, attemptHasMore, attemptRemainingSkillIds, state } =
      await loadPlacementWithSummary({ goalId, plan, timeZone, today, tx, userId });

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
              remainingSkillIds: attemptRemainingSkillIds,
            }
          : null,
        finishedParts: [...finishedParts, receipt],
        ...(attempt.length === "quick" && { quickFollowUpSkillIds: attemptFollowUps ?? [] }),
        result: canContinue ? record.result : { attemptId, finishedAt, lessonsSkipped },
      },
      tx,
    });

    await recordTestOutChange({
      goalId,
      itemIds: [...testedOutPlanItemIds, ...changed.sharedItemIds],
      now,
      receipt: receiptKey,
      timeZone,
      tx,
      userId,
    });

    await owePlanStartLessons({ db: tx, goalId, userId });

    return receipt;
  });

  if (!saved) {
    return null;
  }

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  const [change, plan] = await Promise.all([
    saved.testedOutPlanItemIds.length > 0
      ? readTestOutChange({ goalId, receipt: receiptKey })
      : null,
    loadPlacementPlan(goalId),
  ]);

  const { state } = await loadPlacementWithSummary({ goalId, plan, timeZone, today, userId });

  return {
    areas: state.areas,
    attempt: state.attempt,
    changeId: change?.id ?? null,
    complete: !state.attempt,
    focusTest: null,
    knownSkillIds: saved.knownSkillIds,
    lessonsSkipped: saved.lessonsSkipped,
    partLessonsSkipped: saved.lessonsSkipped,
    phases: state.phases,
    result: state.result,
    testedOutPlanItemIds: saved.testedOutPlanItemIds,
  };
}
