import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { markPlanItemsTestedOut } from "../learner/_utils/known-skills";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { decidePlanChange } from "./decide-plan-change";
import { refreshGoalPlan } from "./refresh-goal-plan";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/**
 * A Monday in 2020, before the learning events other tests write: estimates read everyone's recent
 * pace, and this keeps it out of the dates these tests expect.
 */
const MONDAY = new Date("2020-09-28T12:00:00Z");
const THURSDAY = new Date("2020-10-01T12:00:00Z");

async function setup() {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, library, plan, user };
}

function todoDates(planId: string) {
  return prisma.planItem
    .findMany({ orderBy: { position: "asc" }, where: { planId, status: "todo" } })
    .then((items) => items.map((item) => item.scheduledFor?.toISOString().slice(0, 10)));
}

describe(refreshGoalPlan, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes nothing when nothing moved", async () => {
    const { goal, plan } = await setup();
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });

    const after = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after.version).toBe(before.version);
  });

  it("re-flows missed days from today instead of piling them up, and says so once", async () => {
    const { goal, plan } = await setup();
    vi.setSystemTime(THURSDAY);

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "refreshed",
    });

    const dates = await todoDates(plan.id);
    expect(dates.every((date) => date !== undefined && date >= "2020-10-01")).toBe(true);
    expect(dates[0]).toBe("2020-10-01");

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });
    expect(changes).toHaveLength(1);

    expect(changes[0]).toMatchObject({
      kind: "missedDays",
      payload: { days: 3, source: "system" },
      status: "applied",
    });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({
      status: "unchanged",
    });
  });

  it("leaves paused goals and unbuilt plans alone", async () => {
    const { goal } = await setup();
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toStrictEqual({ status: "paused" });

    const user = await userFixture();
    const unbuilt = await unplannedGoalFixture({ userId: user.id });

    await expect(refreshGoalPlan({ goalId: unbuilt.goal.id })).resolves.toStrictEqual({
      status: "notReady",
    });
  });
});

describe("test-outs on the plan", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says what a test-out skipped, pulls the rest forward, and can bring the lessons back", async () => {
    const { goal, library, plan } = await setup();
    const datesBefore = await todoDates(plan.id);
    const endBefore = datesBefore.at(-1);
    const goalPlan = await loadGoalPlan(goal.id);

    const ids = await markPlanItemsTestedOut({
      goalId: goal.id,
      items: goalPlan.items,
      knownSkillIds: new Set([library.skills[0]?.id ?? ""]),
      testedOutAt: MONDAY,
      timeZone: "UTC",
    });

    expect(ids).toHaveLength(8);

    const change = await prisma.planChange.findFirstOrThrow({
      where: { kind: "testedOut", planId: plan.id },
    });

    expect(change.payload).toMatchObject({ lessons: 8, planItemIds: ids, source: "system" });

    const datesAfter = await todoDates(plan.id);
    const endAfter = datesAfter.at(-1);
    expect(endAfter && endBefore && endAfter < endBefore).toBe(true);

    const undone = await decidePlanChange({
      changeId: change.id,
      goalId: goal.id,
      input: { status: "undone" },
    });

    expect(undone).toMatchObject({
      change: { kind: "testedOut", lessonsSkipped: 8, status: "undone" },
    });

    const restored = await prisma.planItem.count({ where: { id: { in: ids }, status: "todo" } });
    expect(restored).toBe(8);
    await expect(todoDates(plan.id).then((dates) => dates.at(-1))).resolves.toBe(endBefore);
  });
});
