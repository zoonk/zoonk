import { prisma } from "@zoonk/db";
import "server-only";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { dropSessionTestQuestions } from "../../sessions/_utils/drop-test-questions";
import { findOwnedGoal, getAnswerTimeZone } from "../_utils/owned-goal";
import { writeLearnerChange } from "../_utils/write-learner-change";
import { loadCurrentTestSummary } from "../facts/focus-test-summary";
import { changeFocusTestRecord } from "./_utils/focus-test-record";
import { type FocusTestControlsInput, type FocusTestSummary } from "./focus-test-contract";
import { type FocusTestRecord } from "./focus-test-state";
import { readFocusTestSummary } from "./focus-test-summary";

export type FocusTestControlsResult =
  | { focusTest: FocusTestSummary; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

function withControls({
  input,
  now,
  record,
  today,
}: {
  input: FocusTestControlsInput;
  now: Date;
  record: FocusTestRecord;
  today: Date;
}): FocusTestRecord {
  const at = now.toISOString();
  const { sessionQuestions } = input;

  return {
    ...record,
    ...(sessionQuestions === "on" && { pausedAt: null, skippedOn: null }),
    ...(sessionQuestions === "paused" && { pausedAt: record.pausedAt ?? at }),
    ...(sessionQuestions === "skippedToday" && { skippedOn: toIsoDate(today) }),
    ...(input.suggestion === "dismissed" && { dismissedAt: record.dismissedAt ?? at }),
  };
}

/**
 * The learner's own switches on an exam goal's Focus test: its questions inside sessions and
 * Today's suggestion. Skipping today or pausing also takes the unanswered ones out of the day's
 * session. `unavailable`: the goal isn't an exam.
 */
export async function updateFocusTest({
  goalId,
  input,
}: {
  goalId: string;
  input: FocusTestControlsInput;
}): Promise<FocusTestControlsResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "exam") {
    return { status: "unavailable" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });
  const today = getDateInTimeZone({ date: now, timeZone });

  await writeLearnerChange({ userId }, async (tx) => {
    await changeFocusTestRecord({
      change: (record) => withControls({ input, now, record, today }),
      goalId,
      tx,
    });
  });

  if (input.sessionQuestions === "paused" || input.sessionQuestions === "skippedToday") {
    await dropSessionTestQuestions({ goalId, localDate: today, userId });
  }

  revalidateCacheTags([
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getUserProgressCacheTag(userId),
  ]);

  const saved = await prisma.goal.findUniqueOrThrow({
    select: { createdAt: true, details: true, kind: true, plan: { select: { settings: true } } },
    where: { id: goalId },
  });

  const focusTest = readFocusTestSummary({
    focusAreas: parsePlanSettings(saved.plan?.settings).focusAreas,
    goal: saved,
    localDate: today,
    summary: await loadCurrentTestSummary({ goalId, now, userId }),
    timeZone,
  });

  return focusTest ? { focusTest, status: "ready" } : { status: "unavailable" };
}
