import "server-only";
import { type Goal, type Plan, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { loadFocusOwnership } from "../learner/placement/_utils/focus-proposal-facts";
import { saveTestSummary } from "../learner/placement/_utils/test-sitting";
import { FOCUS_TEST_SOURCE } from "../learner/placement/focus-test-contract";
import { readFocusTestRecord } from "../learner/placement/focus-test-state";
import { parsePlanSettings } from "../plans/planner/plan-state";
import { proposePlanChange } from "../plans/propose-plan-change";
import { isRebalanceDue } from "./rebalance-rule";

export async function rebalanceFocusTest({
  goal,
  now,
  plan,
}: {
  goal: Goal;
  now: Date;
  plan: Pick<Plan, "coveredShare" | "id" | "settings">;
}): Promise<void> {
  if (
    goal.kind !== "exam" ||
    !goal.targetDate ||
    plan.coveredShare === null ||
    plan.coveredShare >= 1
  ) {
    return;
  }

  const record = readFocusTestRecord(goal);

  if (!record?.summary?.asked) {
    return;
  }

  const { focusAreas } = parsePlanSettings(plan.settings);
  const ownership = await loadFocusOwnership({ focusAreas, planId: plan.id, record, tx: prisma });

  if (ownership.handPicked) {
    return;
  }

  const last = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true, status: true },
    where: { payload: { equals: FOCUS_TEST_SOURCE, path: ["source"] }, planId: plan.id },
  });

  const since = new Date(
    Math.max(
      (ownership.lastChangedAt ?? new Date(record?.startedAt ?? goal.createdAt)).getTime(),
      last?.createdAt.getTime() ?? 0,
    ),
  );

  if (last?.status === "proposed" || !isRebalanceDue({ lastRebalanceAt: since, now })) {
    return;
  }

  const timeZone = getAnswerTimeZone({ goal });

  const { focusTest } = await saveTestSummary({
    goalId: goal.id,
    timeZone,
    today: getDateInTimeZone({ date: now, timeZone }),
    userId: goal.userId,
  });

  if (!focusTest?.dueFocus || focusTest.sittingId) {
    return;
  }

  await proposePlanChange({
    approval: "always",
    goalId: goal.id,
    operations: [{ areas: focusTest.dueFocus, kind: "focusAreas" }],
    reason: "",
    source: FOCUS_TEST_SOURCE,
    timeZone,
  });
}
