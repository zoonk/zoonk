import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { proposePlanChange } from "./propose-plan-change";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics"],
    skills: [
      { area: "Math", lessons: 8 },
      { area: "Biology", lessons: 6 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan };
}

async function readPlan(planId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({
    include: { goal: true, items: { orderBy: { position: "asc" } } },
    where: { id: planId },
  });

  return {
    dailyMinutes: plan.goal.dailyMinutes,
    items: plan.items.map((item) => [item.kind, item.skillId, item.scheduledFor?.toISOString()]),
  };
}

function decide(goalId: string, changeId: string, status: "applied" | "undone") {
  return decidePlanChange({ changeId, goalId, input: { status } });
}

describe("undoing an applied suggestion", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts the plan back and the suggestion back to waiting, ready to apply again", async () => {
    const { goal, plan } = await setup();
    const before = await readPlan(plan.id);

    const proposal = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 30 }],
      reason: "Longer days, so the plan ends sooner.",
      source: "memory",
    });

    const changeId = "changeId" in proposal ? proposal.changeId : "";
    expect(proposal).toMatchObject({ status: "proposed" });

    await expect(decide(goal.id, changeId, "applied")).resolves.toMatchObject({
      change: { canUndo: true, status: "applied" },
      status: "updated",
    });

    await expect(readPlan(plan.id)).resolves.toMatchObject({ dailyMinutes: 30 });

    await expect(decide(goal.id, changeId, "undone")).resolves.toMatchObject({
      change: { canUndo: false, status: "proposed" },
      status: "updated",
    });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);

    await expect(decide(goal.id, changeId, "applied")).resolves.toMatchObject({
      change: { status: "applied" },
      status: "updated",
    });

    await expect(decide(goal.id, changeId, "undone")).resolves.toMatchObject({
      change: { status: "proposed" },
      status: "updated",
    });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);
  });

  it("applies a suggestion no bigger than a lesson at once, and Undo puts the plan back", async () => {
    const { goal, plan } = await setup();

    const older = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 30 }],
      reason: "Longer days, so the plan ends sooner.",
      source: "memory",
    });

    await decide(goal.id, "changeId" in older ? older.changeId : "", "applied");
    const before = await readPlan(plan.id);

    const hour = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 60 }],
      reason: "An hour a day, to finish sooner.",
      source: "memory",
    });

    expect(hour).toMatchObject({ status: "applied" });
    await expect(readPlan(plan.id)).resolves.toMatchObject({ dailyMinutes: 60 });

    await expect(
      decide(goal.id, "changeId" in hour ? hour.changeId : "", "undone"),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);
  });

  it("lets a newer suggestion about the same thing win over the one it gives back", async () => {
    const { goal, plan } = await setup();
    const before = await readPlan(plan.id);

    const older = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 30 }],
      reason: "Longer days, so the plan ends sooner.",
      source: "memory",
    });

    const olderId = "changeId" in older ? older.changeId : "";
    await decide(goal.id, olderId, "applied");

    const newer = await proposePlanChange({
      goalId: goal.id,
      operations: [{ kind: "setDailyMinutes", minutes: 5 }],
      reason: "Five minutes a day, to keep each day light.",
      source: "memory",
    });

    expect(newer).toMatchObject({ status: "proposed" });

    await expect(decide(goal.id, olderId, "undone")).resolves.toMatchObject({
      change: { status: "replaced" },
      status: "updated",
    });

    await expect(readPlan(plan.id)).resolves.toStrictEqual(before);

    await expect(
      prisma.planChange.findMany({
        select: { id: true },
        where: { planId: plan.id, status: "proposed" },
      }),
    ).resolves.toStrictEqual([{ id: "changeId" in newer ? newer.changeId : "" }]);
  });

  it("leaves a change the learner made themselves undone", async () => {
    const { goal } = await setup();

    const applied = await changeGoalPlan({
      goalId: goal.id,
      input: { operations: [{ kind: "setDailyMinutes", minutes: 30 }] },
    });

    const changeId = applied.status === "applied" ? (applied.change?.id ?? "") : "";

    await expect(decide(goal.id, changeId, "undone")).resolves.toMatchObject({
      change: { status: "undone" },
      status: "updated",
    });
  });
});
