import "server-only";
import { randomUUID } from "node:crypto";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../../cache/tags";
import { oweFollowUps } from "../../../follow-ups/owe-follow-ups";
import { getPlanState } from "../../../plans/_utils/plan-context";
import { type PlanState } from "../../../plans/planner/plan-state";
import { settleAnsweredActivity } from "../../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../../stats/completion-energy";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { writeLearnerChange } from "../../_utils/write-learner-change";
import { type FocusTestOffer } from "../focus-test-contract";
import { type SittingKind } from "../focus-test-rules";
import { readFocusTestRecord } from "../focus-test-state";
import { isPlacementSkipped } from "../placement-contract";
import { type OwnLevel } from "../placement-steps";
import { changeFocusTestRecord } from "./focus-test-record";
import { summaryInputsKey } from "./focus-test-setup";
import { loadPlacementWithSummary } from "./load-placement-state";
import { SITTING_ANSWER_FILTER } from "./placement-answers";

/**
 * Opens the sitting the offer promised; one already open stays as it is. The first start also
 * owes the questions a plan build skipped for a learner who passed placement by.
 */
export async function openTestSitting({
  goal,
  now,
  offer,
  planId,
}: {
  goal: Pick<Goal, "details" | "id" | "userId">;
  now: Date;
  offer: Pick<FocusTestOffer, "kind" | "questions">;
  planId: string;
}): Promise<void> {
  const at = now.toISOString();

  await writeLearnerChange({ lockPlanIds: [planId], userId: goal.userId }, async (tx) => {
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
        ...SITTING_ANSWER_FILTER,
        skillId: { in: skillIds },
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

type SummaryRead = {
  goalId: string;
  onlyFirst?: boolean;
  ownLevel?: OwnLevel | null;
  today?: Date;
  timeZone?: string;
  userId: string;
};

/** Call inside a transaction that holds the learner's lock, so the plan it counts is the committed one. */
async function keepTestSummary({
  onlyFirst = false,
  tx,
  ...read
}: SummaryRead & { tx: TransactionClient }) {
  const plan = await loadPlacementPlan(read.goalId, tx);
  const saved = await loadPlacementWithSummary({ ...read, plan, tx });
  const { focusTest, state } = saved;

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
      goalId: read.goalId,
      tx,
    });
  }

  return saved;
}

/** Reads and keeps the summary under the learner's lock, so an earlier answer can't overwrite a later one. */
export async function saveTestSummary(read: SummaryRead) {
  const saved = await writeLearnerChange({ userId: read.userId }, (tx) =>
    keepTestSummary({ ...read, tx }),
  );

  revalidateCacheTags([getGoalsCacheTag(read.userId)]);
  return saved;
}

/**
 * Counts the saved summary again when what it was counted from changed. Call in a transaction that
 * holds the learner's lock, with the goal and plan as committed there.
 */
export async function keepSummaryCurrent({
  tx,
  ...inputs
}: Parameters<typeof summaryInputsKey>[0] & { tx: TransactionClient }): Promise<boolean> {
  const summary = readFocusTestRecord(inputs.goal)?.summary;

  if (!summary || summary.inputsKey === summaryInputsKey(inputs)) {
    return false;
  }

  await keepTestSummary({ goalId: inputs.goal.id, tx, userId: inputs.goal.userId });
  return true;
}

/** `keepSummaryCurrent` for a write that has the goal's id; pass the plan it wrote, if it wrote one. */
export async function refreshTestSummary({
  goalId,
  plan,
  tx,
}: {
  goalId: string;
  plan?: Pick<PlanState, "graph" | "settings">;
  tx: TransactionClient;
}): Promise<boolean> {
  const goal = await tx.goal.findUnique({
    include: { examBlueprint: true },
    where: { id: goalId },
  });

  if (!goal || !readFocusTestRecord(goal)?.summary) {
    return false;
  }

  const { graph, settings } =
    plan ??
    getPlanState({
      goal,
      plan: await tx.plan.findUniqueOrThrow({
        select: { graph: true, settings: true },
        where: { goalId },
      }),
    });

  return keepSummaryCurrent({ goal, graph, settings, tx });
}
