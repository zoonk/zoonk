import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { testEventContext, trackTestEvents } from "../../../analytics/test-events";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { owePlanStartLessons } from "../../../follow-ups/owe-goal-lessons";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { recordTestOutChange } from "../../../plans/record-test-out-change";
import { type GoalPlan, loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { loadSkillConfirmations } from "../../_utils/load-skill-claims";
import { testOutKnownPlanItems } from "../../_utils/test-out-known-plan-items";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { type PlacementCompletion } from "./complete-placement";
import { applyCourseStart } from "./course-start-items";
import { loadPlacementWithSummary } from "./load-placement-state";
import { SITTING_ANSWER_SQL } from "./placement-answers";
import { savePlacementAttempt } from "./placement-attempt";
import {
  type PlacementAttempt,
  type PlacementRecord,
  readPlacementAttempt,
} from "./placement-attempt-record";
import { readPlacementCourse, readPlacementNextLesson } from "./placement-result";

async function applyPartAnswers({
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

function findAppliedReceipt({
  answered,
  complete,
  receipts,
}: {
  answered: number;
  complete: boolean;
  receipts: PlacementRecord["finishedParts"];
}) {
  return receipts.findLast(
    (receipt) =>
      receipt.finish?.answered === answered && (receipt.finish.end !== "stopped" || !complete),
  );
}

async function savePart({
  answered,
  attemptId,
  goal,
  now,
  part,
  timeZone,
  today,
  tx,
}: {
  answered?: number;
  attemptId: string;
  goal: Goal;
  now: Date;
  part: number;
  timeZone: string;
  today: Date;
  tx: TransactionClient;
}) {
  const { id: goalId, userId } = goal;
  const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
  const record = readPlacementAttempt(current);
  const { attempt, finishedParts, result } = record;

  if ((attempt?.id ?? result?.attemptId) !== attemptId) {
    return unchanged(null);
  }

  const receipts = finishedParts.filter((finished) => finished.part === part);
  const last = receipts.at(-1);

  if (attempt?.part !== part || attempt.partComplete) {
    return unchanged({ event: null, receipt: last ?? null });
  }

  const plan = await loadPlacementPlan(goalId, tx);

  const { attemptQuestions, state } = await loadPlacementWithSummary({
    goalId,
    plan,
    timeZone,
    today,
    tx,
    userId,
  });

  if (!attemptQuestions || state.status === "failed") {
    return unchanged(null);
  }

  const previous = findAppliedReceipt({
    answered: answered ?? attemptQuestions.answered,
    complete: attemptQuestions.complete,
    receipts,
  });

  if (previous) {
    return unchanged({ event: null, receipt: previous });
  }

  if (answered !== undefined && answered !== attemptQuestions.answered) {
    return unchanged(null);
  }

  const receiptKey = placementPartReceipt(
    attemptId,
    part,
    attemptQuestions.complete ? undefined : attemptQuestions.answered,
  );

  const newTopics = new Set(attemptQuestions.partAnswers.slice(last?.finish?.answered));

  const { confirmed, heldUntilTomorrow, partLessonsSkipped, testedOutPlanItemIds, sharedItemIds } =
    attempt.search
      ? await applyCourseStart({
          goalId,
          now,
          startedPastSkillIds: attemptQuestions.startedPastSkillIds,
          tx,
        })
      : await applyPartAnswers({
          attempt,
          goal,
          now,
          plan,
          skillIds: state.knownSkillIds,
          timeZone,
          today,
          tx,
        });

  const lessonsSkipped = attempt.lessonsSkipped + partLessonsSkipped;
  const held = heldUntilTomorrow ? { heldUntilTomorrow: true as const } : {};

  const finish = {
    answered: attemptQuestions.answered,
    end: attemptQuestions.end,
    lessonsSkipped: partLessonsSkipped,
    unknowns: attemptQuestions.unknowns,
  };

  const receipt = {
    ...held,
    finish,
    knownSkillIds: [...confirmed].filter((id) => newTopics.has(id)),
    lessonsSkipped: partLessonsSkipped,
    part,
    testedOutPlanItemIds,
  };

  const nextLesson = await readPlacementNextLesson(goalId, tx);
  const course = await readPlacementCourse(goalId, new Set(testedOutPlanItemIds), tx);

  const first = attempt.search?.topics?.find(
    (topic) => !attemptQuestions.startedPastSkillIds.includes(topic.id),
  );

  await savePlacementAttempt({
    goal: current,
    record: {
      ...record,
      attempt: null,
      finishedParts: [...finishedParts, receipt],
      result: {
        ...held,
        attemptId,
        chapter: nextLesson?.chapter ?? first?.chapter ?? null,
        course,
        finish,
        finishedAt: now.toISOString(),
        lessonsSkipped,
        nextLesson,
        ...(attempt.search && { startedPastSkillIds: attemptQuestions.startedPastSkillIds }),
      },
    },
    tx,
  });

  await recordTestOutChange({
    goalId,
    itemIds: [...testedOutPlanItemIds, ...sharedItemIds],
    now,
    receipt: receiptKey,
    ...(attempt.search && { startedPastSkillIds: attemptQuestions.startedPastSkillIds }),
    timeZone,
    tx,
    userId,
  });

  await owePlanStartLessons({ db: tx, goalId, userId });

  return {
    event: {
      name: "Test Finished" as const,
      properties: {
        ...testEventContext(current, {
          attemptId,
          part,
          parts: 1,
          questions: attemptQuestions.questions,
          test: "course",
        }),
        answered: finish.answered,
        duration_ms: attemptQuestions.durationMs,
        end: finish.end,
        lessons_skipped: finish.lessonsSkipped,
        levels_skipped: 0,
        parts_left: 0,
        unknowns: finish.unknowns,
      },
    },
    receipt,
  };
}

export async function finishPlacementAttempt({
  answered,
  attemptId,
  goal,
  part = 1,
  timeZone,
}: {
  answered?: number;
  attemptId: string;
  goal: Goal;
  part?: number;
  timeZone: string;
}): Promise<PlacementCompletion | null> {
  const { id: goalId, userId } = goal;
  const now = new Date();
  const today = getDateInTimeZone({ date: now, timeZone });

  const finished = await writeLearnerChange({ planInputs: true, userId }, (tx) =>
    savePart({ answered, attemptId, goal, now, part, timeZone, today, tx }),
  );

  if (!finished?.receipt) {
    return null;
  }

  const { event, receipt: saved } = finished;

  if (event) {
    trackTestEvents(goal, [event]);
  }

  revalidateCacheTags([getGoalsCacheTag(userId)]);

  const receiptKey = placementPartReceipt(
    attemptId,
    part,
    saved.finish?.end === "stopped" ? saved.finish.answered : undefined,
  );

  const [change, plan] = await Promise.all([
    readTestOutChange({ goalId, receipt: receiptKey }),
    loadPlacementPlan(goalId),
  ]);

  const { state } = await loadPlacementWithSummary({ goalId, plan, timeZone, today, userId });

  return {
    areas: state.areas,
    attempt: state.attempt,
    changeId: change?.id ?? null,
    complete: !state.attempt,
    finish: saved.finish,
    focusTest: null,
    ...(saved.heldUntilTomorrow && { heldUntilTomorrow: saved.heldUntilTomorrow }),
    knownSkillIds: saved.knownSkillIds,
    lessonsSkipped: saved.lessonsSkipped,
    phases: state.phases,
    result: state.result,
    testedOutPlanItemIds: saved.testedOutPlanItemIds,
  };
}
