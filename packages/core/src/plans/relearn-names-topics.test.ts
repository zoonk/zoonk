import { prisma } from "@zoonk/db";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadPlanCarryOver } from "./_utils/carried-lessons";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { bringBackMissedLessons } from "./bring-back-missed-lessons";
import { createGoalPlan } from "./create-goal-plan";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

describe("a miss that brings a known topic's lessons back", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // R5 (OAB seed 1002): a practice miss on a topic taken as known planned the plan again from
  // today, which also brought in the legislative process and juvenile offense topics, and its card
  // named only the missed topic.
  it("names every topic the plan planned again brings in, not only the missed one", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      skills: [
        { area: "Math", lessons: 3 },
        { area: "Writing", lessons: 3 },
      ],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    const [known, left] = library.skills;

    // Placement took the first skill as known; the plan the learner sees left the second out.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { completedAt: NOW, status: "testedOut" },
        where: { planId: plan.id, skillId: known?.id },
      }),
      prisma.planItem.deleteMany({ where: { planId: plan.id, skillId: left?.id } }),
    ]);

    await bringBackMissedLessons({
      goalId: goal.id,
      now: NOW,
      skillIds: [known?.id ?? ""],
      timeZone: "UTC",
    });

    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "relearn", planId: plan.id },
    });

    expect(parsePlanChangePayload(change.payload).effect?.topicsAdded).toStrictEqual([
      { area: "Math", topics: [known?.name] },
      { area: "Writing", topics: [left?.name] },
    ]);
  });

  // R19 (class test seed 2080): on a day that carried missed work, a test-out answer brought a
  // tested-out topic back and named it, and the same step's re-plan for the lessons it skipped
  // dropped the topic's lessons again: ranked behind the carried work before the class test.
  it("carries the lessons it brought back on every later run that day", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await planChangeFixture({
      createdAt: new Date("2020-09-28T09:00:00Z"),
      kind: "relearn",
      payload: { carriedItemIds: ["relearned-1", "relearned-2"], source: "system" },
      planId: plan.id,
      status: "applied",
    });

    const context = { goal, plan, timeZone: "UTC", today: new Date("2020-09-28T00:00:00Z") };

    await expect(loadPlanCarryOver({ context, mode: "automatic" })).resolves.toStrictEqual({
      itemIds: ["relearned-1", "relearned-2"],
      lessonIds: [],
    });
  });
});
