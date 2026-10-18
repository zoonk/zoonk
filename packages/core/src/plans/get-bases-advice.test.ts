import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { day, enemBiologyGoal, setClock } from "./_test-utils/enem-biology";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getPlanBasesAdvice } from "./get-bases-advice";

/*
 * What the app recommends for a plan's bases plans the goal with every base in depth, so it's
 * worked out only when the learner asks ("Get a recommendation"), never for a page: the plan's
 * view lists the bases and the learner's choices without it (see plan-choices.test.ts for what it
 * recommends).
 */
describe(getPlanBasesAdvice, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    setClock(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recommends for the learner's own plan only", async () => {
    const built = await enemBiologyGoal({ days: 30 });
    mockSession(built.user.id);
    await createGoalPlan({ goalId: built.goal.id, graph: built.graph });

    await expect(getPlanBasesAdvice(built.goal.id)).resolves.toMatchObject({
      advice: { daysLeft: 30, ready: true },
      status: "ready",
    });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getPlanBasesAdvice(built.goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("says it isn't ready while the plan is being built", async () => {
    const user = await userFixture();
    const { goal } = await unplannedGoalFixture({ targetDate: day(30), userId: user.id });
    mockSession(user.id);

    await expect(getPlanBasesAdvice(goal.id)).resolves.toStrictEqual({
      advice: { daysLeft: null, ready: false, recommended: null },
      status: "ready",
    });
  });
});
