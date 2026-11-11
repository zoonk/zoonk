import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { settleAnsweredActivity } from "../../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { writeLearnerChange } from "../../_utils/write-learner-change";
import { type FocusTestOffer } from "../focus-test-contract";
import { type SittingKind } from "../focus-test-rules";
import { isPlacementSkipped } from "../placement-contract";
import { type OwnLevel } from "../placement-steps";
import { changeFocusTestRecord } from "./focus-test-record";
import { loadPlacementWithSummary } from "./load-placement-state";

/**
 * Opens the sitting the offer promised; one already open stays as it is. The first start also
 * owes the questions a plan build skipped for a learner who passed placement by.
 */
export async function openTestSitting({
  goal,
  now,
  offer,
}: {
  goal: Pick<Goal, "details" | "id" | "userId">;
  now: Date;
  offer: Pick<FocusTestOffer, "kind" | "questions">;
}): Promise<void> {
  const at = now.toISOString();

  await writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const { before } = await changeFocusTestRecord({
      change: (record) =>
        record.sitting
          ? record
          : {
              ...record,
              sitting: {
                answered: 0,
                id: randomUUID(),
                kind: offer.kind,
                questions: offer.questions,
                startedAt: at,
              },
              startedAt: record.startedAt ?? at,
            },
      goalId: goal.id,
      tx,
    });

    if (before.startedAt !== null || !isPlacementSkipped(goal)) {
      return;
    }

    await tx.plan.update({ data: { placementPreparedAt: null }, where: { goalId: goal.id } });

    await oweFollowUps({
      db: tx,
      followUps: [
        { input: { goalId: goal.id, waitsForNotice: true }, kind: "preparePlacementItems" },
      ],
      userId: goal.userId,
    });
  });

  revalidateCacheTags([getGoalsCacheTag(goal.userId)]);
}

export type ClosedSitting = {
  answered: number;
  dontKnow: number;
  durationMs: number;
  kind: SittingKind;
  questions: number;
};

/**
 * Closes only the observed sitting, once: on a plan the learner has seen, its time and Energy count in the
 * same write, so a repeated close counts nothing twice. Null when no sitting was open.
 */
export async function closeTestSitting({
  goal,
  sittingId,
  skillIds,
  timeZone,
}: {
  goal: Pick<Goal, "id" | "planRevealedAt" | "userId">;
  sittingId: string | null;
  /** The plan's skills, which say which of the learner's answers are this goal's. */
  skillIds: string[];
  timeZone: string;
}): Promise<ClosedSitting | null> {
  const { id: goalId, userId } = goal;

  const closed = await writeLearnerChange({ userId }, async (tx) => {
    const { before } = await changeFocusTestRecord({
      change: (record) =>
        record.sitting?.id === sittingId ? { ...record, sitting: null } : record,
      goalId,
      tx,
    });

    if (!before.sitting || before.sitting.id !== sittingId) {
      return null;
    }

    const answers = await tx.attempt.findMany({
      select: { answer: true, durationMs: true, isCorrect: true },
      where: {
        answeredAt: { gte: new Date(before.sitting.startedAt) },
        isPlacement: true,
        itemId: { not: null },
        skillId: { in: skillIds },
        stepId: null,
        studySessionId: null,
        userId,
      },
    });

    if (goal.planRevealedAt && answers.length > 0) {
      await settleAnsweredActivity(tx, {
        answers,
        contentIds: { focusTestId: before.sitting.id },
        goalId,
        lessonKind: "focusTest",
        lock: await getCompletionEnergyContext({ timeZone, transaction: tx, userId }),
        timeZone,
        userId,
      });
    }

    return {
      answered: answers.length,
      dontKnow: answers.filter(
        (given) => isJsonObject(given.answer) && given.answer.dontKnow === true,
      ).length,
      durationMs: answers.reduce((total, given) => total + given.durationMs, 0),
      kind: before.sitting.kind,
      questions: before.sitting.questions,
    };
  });

  revalidateCacheTags([
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getUserProgressCacheTag(userId),
  ]);

  return closed;
}

/** Reads and keeps the summary under the learner's lock, so an earlier answer can't overwrite a later one. */
export async function saveTestSummary({
  goalId,
  onlyFirst = false,
  ownLevel,
  plan,
  today,
  timeZone,
  userId,
}: {
  goalId: string;
  onlyFirst?: boolean;
  ownLevel?: OwnLevel | null;
  plan: GoalPlan;
  today?: Date;
  timeZone?: string;
  userId: string;
}) {
  const saved = await writeLearnerChange({ userId }, async (tx) => {
    const read = await loadPlacementWithSummary({
      goalId,
      ownLevel,
      plan,
      timeZone,
      today,
      tx,
      userId,
    });

    const { focusTest, state } = read;

    if (focusTest) {
      await changeFocusTestRecord({
        change: (record) => ({
          ...record,
          sitting:
            record.sitting && state.focusTest?.sitting
              ? { ...record.sitting, answered: state.focusTest.sitting.answered }
              : record.sitting,
          summary: onlyFirst && record.summary ? record.summary : focusTest.summary,
        }),
        goalId,
        tx,
      });
    }

    return read;
  });

  revalidateCacheTags([getGoalsCacheTag(userId)]);
  return saved;
}

/** Notes the suggestion the test settled with the plan, so it isn't settled again. */
export async function keepHandledSuggestion({
  areas,
  goalId,
  inPlan,
  userId,
}: {
  areas: string[];
  goalId: string;
  /** The plan already follows it: a focus on it changes nothing. */
  inPlan: boolean;
  userId: string;
}): Promise<void> {
  await writeLearnerChange({ userId }, async (tx) => {
    await changeFocusTestRecord({
      change: (record) => ({ ...record, handled: { areas, inPlan } }),
      goalId,
      tx,
    });
  });

  revalidateCacheTags([getGoalsCacheTag(userId)]);
}
