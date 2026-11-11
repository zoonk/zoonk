import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { holdPlanLock, waitForBlockedStatement } from "../../_test-utils/learner-lock";
import { examTestGoalFixture } from "../_test-utils/exam-test-goal";
import { markLearnerChanged } from "../_utils/mark-learner-changed";
import { startPlacementSitting } from "./start-placement-sitting";

describe("starting a skipped Focus test alongside a plan-input writer", () => {
  it("locks the plan before the learner so both writes finish", async () => {
    const { goal, plan, user } = await examTestGoalFixture({
      goal: { details: { placementDeclined: true } },
      subjects: [{ name: "Math", questions: 10 }],
    });

    const held = holdPlanLock({
      beforeCommit: (tx) => markLearnerChanged(tx, { planInputs: true, userId: user.id }),
      planId: plan.id,
    });

    const pid = await held.pid;
    const started = startPlacementSitting({ goalId: goal.id, input: {} });
    const completed = Promise.allSettled([started, held.done]);

    try {
      await waitForBlockedStatement(pid, /plans/u);
    } finally {
      held.release();
    }

    const results = await completed;
    expect(results.filter((result) => result.status === "rejected")).toStrictEqual([]);
    await expect(started).resolves.toMatchObject({ status: "ready" });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      placementPreparedAt: null,
    });
  });
});
