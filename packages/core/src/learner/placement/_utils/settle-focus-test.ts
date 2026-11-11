import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { proposePlanChange } from "../../../plans/propose-plan-change";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { FOCUS_TEST_SOURCE } from "../focus-test-contract";
import { type PlacementState, loadPlacementState } from "./load-placement-state";
import { keepHandledSuggestion, saveTestSummary } from "./test-sitting";

/**
 * A new plan's first summary, so the plan's row, its reveal and Today can offer the test before
 * the learner touches it. Workflow bridge: the goal comes from the run that built its plan.
 */
export async function startFocusTestSummary(goalId: string): Promise<void> {
  const goal = await prisma.goal.findUnique({
    select: { kind: true, userId: true },
    where: { id: goalId },
  });

  if (goal?.kind !== "exam") {
    return;
  }

  const plan = await loadPlacementPlan(goalId);
  await saveTestSummary({ goalId, onlyFirst: true, plan, userId: goal.userId });
}

/**
 * Where an exam goal's test stands once its answers were applied or a session with its questions
 * ended: saves what the cheap reads show and proposes a focus when one is due, never while a
 * sitting or a session is still asking. Returns the state after both; other goals only read it.
 */
export async function settleFocusTest({
  goalId,
  today,
  userId,
}: {
  goalId: string;
  today: Date;
  userId: string;
}): Promise<PlacementState> {
  const plan = await loadPlacementPlan(goalId);
  const { focusTest, state } = await saveTestSummary({ goalId, plan, today, userId });

  if (!focusTest) {
    return state;
  }

  if (!focusTest.dueFocus) {
    return state;
  }

  const areas = focusTest.dueFocus;

  const proposed = await proposePlanChange({
    approval: "always",
    goalId,
    operations: [{ areas, kind: "focusAreas" }],
    reason: "",
    source: FOCUS_TEST_SOURCE,
  });

  // A focus that wouldn't move the plan is already in it; anything else is tried again later.
  if (proposed.status === "proposed" || proposed.status === "unchanged") {
    await keepHandledSuggestion({ areas, goalId, inPlan: proposed.status === "unchanged", userId });
  }

  return loadPlacementState({ goalId, plan, today, userId });
}

async function settleAfterSession({
  goalId,
  sessionId,
  userId,
}: {
  goalId: string;
  sessionId: string;
  userId: string;
}): Promise<void> {
  const [goal, answers] = await Promise.all([
    prisma.goal.findUnique({ select: { kind: true, timezone: true }, where: { id: goalId } }),
    prisma.attempt.count({ where: { isPlacement: true, studySessionId: sessionId, userId } }),
  ]);

  if (goal?.kind !== "exam" || answers === 0) {
    return;
  }

  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  await settleFocusTest({ goalId, today, userId });
}

/**
 * A session that asked the test's questions settles the test when it ends, never while it asks.
 * Never throws: a failure is logged, and the next test answer or session settles it.
 */
export async function settleFocusTestAfterSession(input: {
  goalId: string | null;
  sessionId: string;
  userId: string;
}): Promise<void> {
  const { goalId } = input;

  if (!goalId) {
    return;
  }

  const { error } = await safeAsync(() => settleAfterSession({ ...input, goalId }));

  if (error) {
    logError(`Could not settle the Focus test of goal ${goalId}.`, error);
  }
}
