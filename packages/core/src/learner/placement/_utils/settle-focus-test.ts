import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { loadPlanChangeView } from "../../../plans/_utils/owned-plan";
import { proposePlanChange } from "../../../plans/propose-plan-change";
import { loadPlacementPlan } from "../../_utils/goal-skill-graph";
import { getAnswerTimeZone } from "../../_utils/owned-goal";
import { FOCUS_TEST_SOURCE } from "../focus-test-contract";
import { type SittingOffer, toFocus } from "../focus-test-view";
import { type PlacementState, loadPlacementState } from "./load-placement-state";
import { saveTestSummary } from "./test-sitting";

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

  await saveTestSummary({ goalId, onlyFirst: true, userId: goal.userId });
}

/**
 * Where an exam goal's test stands once its answers were applied or a session with its questions
 * ended: saves what the cheap reads show and proposes a focus when one is due, never while a
 * sitting or a session is still asking. Returns the state after both, with the sitting a start
 * would open next; other goals only read it.
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
}): Promise<{ offer: SittingOffer | null; state: PlacementState }> {
  const { focusTest, state } = await saveTestSummary({ goalId, timeZone, today, userId });
  const offer = focusTest?.offer ?? null;
  const checkpoint = state.focusTest?.checkpoint;

  if (!focusTest?.dueFocus || !checkpoint || !state.focusTest) {
    return { offer, state };
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
    const reread = await loadPlacementState({
      goalId,
      plan: await loadPlacementPlan(goalId),
      timeZone,
      today,
      userId,
    });

    return { offer, state: reread };
  }

  if (proposed.status !== "proposed") {
    return { offer, state };
  }

  const proposal = await loadPlanChangeView(proposed.changeId);
  const { plan, rows, subjects } = focusTest;

  return {
    offer,
    state: {
      ...state,
      focusTest: {
        ...state.focusTest,
        checkpoint: {
          ...checkpoint,
          focus: toFocus({ plan: { ...plan, proposal }, rows, subjects }),
        },
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
