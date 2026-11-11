import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPlanChangeView } from "../../../plans/_utils/owned-plan";
import { proposePlanChange } from "../../../plans/propose-plan-change";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { FOCUS_TEST_SOURCE } from "../focus-test-contract";
import { toFocus } from "../focus-test-view";
import { type PlacementState, loadPlacementState } from "./load-placement-state";
import { syncTestSitting } from "./test-sitting";

/**
 * Where an exam goal's test stands once its answers were applied or a session with its questions
 * ended: synchronizes its sitting and proposes a focus when one is due, never while a
 * sitting or a session is still asking. Returns the state after both; other goals only read it.
 */
export async function settleFocusTest({
  goalId,
  today,
  timeZone,
  userId,
}: {
  goalId: string;
  today: Date;
  timeZone: string;
  userId: string;
}): Promise<PlacementState> {
  const plan = await loadPlacementPlan(goalId);
  const { focusTest, state } = await syncTestSitting({ goalId, plan, timeZone, today, userId });

  const checkpoint = state.focusTest?.checkpoint;

  if (!focusTest?.dueFocus || !checkpoint || !state.focusTest) {
    return state;
  }

  const areas = focusTest.dueFocus;

  const proposed = await proposePlanChange({
    approval: "always",
    goalId,
    operations: [{ areas, kind: "focusAreas" }],
    reason: "",
    source: FOCUS_TEST_SOURCE,
    timeZone,
  });

  if (proposed.status === "notDue") {
    return loadPlacementState({
      goalId,
      plan: await loadPlacementPlan(goalId),
      timeZone,
      today,
      userId,
    });
  }

  if (proposed.status !== "proposed") {
    return state;
  }

  const proposal = await loadPlanChangeView(proposed.changeId, { timeZone });

  return {
    ...state,
    focusTest: {
      ...state.focusTest,
      checkpoint: {
        ...checkpoint,
        focus: toFocus({ plan: { ...focusTest.plan, proposal }, rows: focusTest.rows }),
      },
    },
  };
}

/** A session that asked the test's questions settles the test when it ends, never while it asks. */
export async function settleFocusTestAfterSession({
  goalId,
  sessionId,
  timeZone: requestedTimeZone,
  userId,
}: {
  goalId: string | null;
  sessionId: string;
  timeZone?: string;
  userId: string;
}): Promise<void> {
  if (!goalId) {
    return;
  }

  const [goal, answers] = await Promise.all([
    prisma.goal.findUnique({ select: { kind: true, timezone: true }, where: { id: goalId } }),
    prisma.attempt.count({ where: { isPlacement: true, studySessionId: sessionId, userId } }),
  ]);

  if (goal?.kind !== "exam" || answers === 0) {
    return;
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: requestedTimeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });
  await settleFocusTest({ goalId, timeZone, today, userId });
}
