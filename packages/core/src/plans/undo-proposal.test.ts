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

/** The plan as the learner sees it: each item on its day, and their daily time. */
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

/*
 * Ana applied Today's suggestion to rest on Saturdays, then undid it: the card said "Undone" and
 * the suggestion was gone until she reloaded, though nothing she chose had changed. Undo puts back
 * what was there before Apply, the question included (Gmail's and Linear's undo restore the prompt
 * too), so the learner can still apply it or say "Not now".
 */
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

    // The learner can still say yes, and undo that too.
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
      operations: [{ kind: "setDailyMinutes", minutes: 60 }],
      reason: "An hour a day, to finish a month earlier.",
      source: "memory",
    });

    expect(newer).toMatchObject({ status: "proposed" });

    // Both waiting would ask two contradicting times; the newer one is the question now.
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
