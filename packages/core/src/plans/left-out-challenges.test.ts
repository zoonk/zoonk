import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { parsePlanPhases } from "./planner/plan-state";

/** A Monday in 2020, before other tests' learning events, so pace estimates don't move dates. */
const NOW = new Date("2020-09-28T12:00:00Z");

async function tightLearner({
  dailyMinutes,
  lessons = [3, 3, 3],
  targetDate,
}: {
  dailyMinutes: number;
  lessons?: number[];
  targetDate: string;
}) {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["One", "Two", "Three"],
    skills: lessons.map((count, phase) => ({ lessons: count, phase })),
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date(`${targetDate}T00:00:00Z`),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan };
}

async function readChallenges(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { items: true },
    where: { id: planId },
  });

  return {
    leftOut: parsePlanPhases(plan.phases).flatMap((phase, index) =>
      phase.challengeLeftOut ? [index] : [],
    ),
    planned: plan.items
      .filter((item) => item.kind === "boss" && item.status === "todo")
      .map((item) => item.phase)
      .toSorted((a, b) => a - b),
  };
}

describe("a phase challenge with no room before the plan's date", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("stays off Today, which keeps every lesson the day holds beside one challenge at most", async () => {
    const { goal, plan } = await tightLearner({ dailyMinutes: 15, targetDate: "2020-09-29" });
    const today = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (today.status !== "ready") {
      throw new Error(`Expected Today, got ${today.status}`);
    }

    const lessons = await prisma.planItem.count({
      where: { kind: "lesson", planId: plan.id, scheduledFor: new Date("2020-09-28T00:00:00Z") },
    });

    const kinds = today.today.session.blocks.map((block) => block.kind);

    expect(lessons).toBeGreaterThan(0);
    expect(kinds.filter((kind) => kind === "learn")).toHaveLength(lessons);
    expect(kinds.filter((kind) => kind === "checkpoint").length).toBeLessThanOrEqual(1);
  });

  it("is said on its phase in the Plan", async () => {
    const { goal } = await tightLearner({ dailyMinutes: 15, targetDate: "2020-09-29" });
    const result = await getGoalPlan(goal.id);

    if (result.status !== "ready") {
      throw new Error(`Expected the Plan, got ${result.status}`);
    }

    expect(
      result.plan.phases.map(({ challengeLeftOut, state }) => ({ challengeLeftOut, state })),
    ).toStrictEqual([
      { challengeLeftOut: false, state: "current" },
      { challengeLeftOut: true, state: "upcoming" },
      { challengeLeftOut: true, state: "upcoming" },
    ]);
  });

  it("comes back once the learner gives the plan more time", async () => {
    const { goal, plan } = await tightLearner({
      dailyMinutes: 5,
      lessons: [2, 20, 20],
      targetDate: "2020-10-02",
    });

    const before = await readChallenges(plan.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 60 }], timeZone: "UTC" },
    });

    const after = await readChallenges(plan.id);

    expect(before).toStrictEqual({ leftOut: [1], planned: [0] });
    expect(after).toStrictEqual({ leftOut: [], planned: [0, 1, 2] });
  });

  it("comes back once the learner moves the date", async () => {
    const { goal, plan } = await tightLearner({ dailyMinutes: 15, targetDate: "2020-09-29" });
    const before = await readChallenges(plan.id);

    await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setTargetDate", targetDate: "2020-10-09" }], timeZone: "UTC" },
    });

    expect(before).toStrictEqual({ leftOut: [1, 2], planned: [0] });

    await expect(readChallenges(plan.id)).resolves.toStrictEqual({
      leftOut: [],
      planned: [0, 1, 2],
    });
  });
});
