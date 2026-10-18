import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AHEAD_START, aheadPlanFixture, readPlanScreen } from "./_test-utils/ahead-plan";
import { changeGoalPlan } from "./change-goal-plan";
import { findPlanTimeToCover } from "./get-time-advice";

/*
 * Pedro's Plan offered "10 min a day covers everything in depth" beside his 15, and its preview
 * added 3 lessons while his last phases stayed out of the plan: the time it recommended came from
 * the plan as the graph sizes it, which knew nothing of the four lessons the Library wrote for each
 * topic. The time the Plan finds when the learner asks ("Find the time that covers everything") is
 * one at which the plan a switch to it plans covers everything, as the Plan then says.
 */
describe("the daily time the Plan finds", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("covers everything once the learner switches to it", async () => {
    const { goal } = await aheadPlanFixture({ dailyMinutes: 10 });
    const before = await readPlanScreen();
    const found = await findPlanTimeToCover({ goalId: goal.id, input: {} });
    const minutes = found.status === "ready" ? (found.time.recommendedMinutes ?? 0) : 0;

    expect(before?.feasibility).toMatchObject({ coreFits: false, fits: false });
    expect(minutes).toBeGreaterThan(10);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: { operations: [{ kind: "setDailyMinutes", minutes }] },
      }),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(readPlanScreen()).resolves.toMatchObject({
      feasibility: { coreFits: true, fits: true },
    });
  });
});
