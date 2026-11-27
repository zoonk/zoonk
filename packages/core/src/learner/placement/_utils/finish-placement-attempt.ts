import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { testEventContext, trackTestEvents } from "../../../analytics/test-events";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../../cache/tags";
import { owePlanStartLessons } from "../../../follow-ups/owe-goal-lessons";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { placementPartReceipt } from "../../../plans/_utils/test-out-receipt";
import { recordTestOutChange } from "../../../plans/record-test-out-change";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { unchanged, writeLearnerChange } from "../../_utils/write-learner-change";
import { applyLegacyPlacement } from "./apply-legacy-placement";
import { type PlacementCompletion } from "./complete-placement";
import { makeReceipt, storeFinishedResult } from "./course-placement-receipt";
import { applyCourseStart } from "./course-start-items";
import { loadPlacementWithSummary } from "./load-placement-state";
import { savePlacementAttempt } from "./placement-attempt";
import { type PlacementRecord, readPlacementAttempt } from "./placement-attempt-record";

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

function currentAttemptId(record: PlacementRecord) {
  return record.attempt?.id ?? record.result?.attemptId;
}

function isFinishedLegacyPart(attempt: PlacementRecord["attempt"]) {
  return attempt && !attempt.search && attempt.partComplete;
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
  const { attempt, finishedParts } = record;

  if (currentAttemptId(record) !== attemptId) {
    return unchanged(null);
  }

  const receipts = finishedParts.filter((finished) => finished.part === part);
  const last = receipts.at(-1);

  if (isFinishedLegacyPart(attempt)) {
    await savePlacementAttempt({ goal: current, record: { ...record, attempt: null }, tx });
    return { event: null, receipt: last ?? finishedParts.at(-1) ?? null };
  }

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

  if ((answered ?? attemptQuestions.answered) !== attemptQuestions.answered) {
    return unchanged(null);
  }

  const receiptKey = placementPartReceipt(
    attemptId,
    part,
    attemptQuestions.complete ? undefined : attemptQuestions.answered,
  );

  const { confirmed, heldUntilTomorrow, partLessonsSkipped, testedOutPlanItemIds, sharedItemIds } =
    attempt.search
      ? await applyCourseStart({
          goalId,
          lineSkillIds: attempt.search.topics?.map((topic) => topic.id),
          now,
          startedPastSkillIds: attemptQuestions.startedPastSkillIds,
          tx,
        })
      : await applyLegacyPlacement({
          attempt,
          goal,
          now,
          plan,
          skillIds: state.knownSkillIds,
          timeZone,
          today,
          tx,
        });

  const { finish, held, lessonsSkipped, receipt } = makeReceipt({
    attempt,
    attemptQuestions,
    confirmed,
    heldUntilTomorrow,
    last,
    part,
    partLessonsSkipped,
    testedOutPlanItemIds,
  });

  await storeFinishedResult({
    attempt,
    attemptQuestions,
    current,
    finish,
    goalId,
    held,
    lessonsSkipped,
    now,
    receipt,
    record,
    testedOutPlanItemIds,
    tx,
  });

  await recordTestOutChange({
    goalId,
    itemIds: [...testedOutPlanItemIds, ...sharedItemIds],
    now,
    receipt: receiptKey,
    ...(attempt.search && {
      lineSkillIds: attempt.search.topics?.map((topic) => topic.id),
      startedPastSkillIds: attemptQuestions.startedPastSkillIds,
    }),
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

  const previous = readPlacementAttempt(goal).attempt;

  const storedPart =
    previous && previous.id === attemptId && !previous.search ? previous.part : part;

  const finished = await writeLearnerChange({ planInputs: true, userId }, (tx) =>
    savePart({ answered, attemptId, goal, now, part: storedPart, timeZone, today, tx }),
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
    saved.part,
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
