import { prisma } from "@zoonk/db";
import { unplannedCheckpointFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { lookUpPlanData } from "./_utils/lookups/plan-lookups";
import { loadPlanDayContext } from "./_utils/plan-day-context";

async function selectedCheckpointFixture() {
  const user = await userFixture();
  const fixture = await unplannedCheckpointFixture({ userId: user.id });
  await createGoalPlan({ goalId: fixture.goal.id, graph: fixture.graph });
  mockSession(user.id);
  // A legacy plan can lack a newly selected checkpoint. Only the next POST may persist it.
  await prisma.$transaction(async (tx) => {
    await markPlansChanged(tx, { planIds: [fixture.plan.id] });
    await tx.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });
  });

  const result = await getGoalPlan(fixture.goal.id);

  if (result.status !== "ready") {
    throw new Error("Expected the actual selected Plan");
  }

  const checkpoint = result.plan.phases[0]?.checkpoint;
  expect(checkpoint).toBeNull();
  return { ...fixture, checkpoint, view: result.plan };
}

describe("Buddy reads selected items that the next POST has not saved yet", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("keeps the challenge lookup's actual date with no fabricated link", async () => {
    const fixture = await selectedCheckpointFixture();

    const read = await countDatabaseStatements(() =>
      lookUpPlanData({
        area: null,
        goal: fixture.goal,
        linkScope: { activeGoal: true },
        query: null,
        what: "challenges",
      }),
    );

    expect(read.writes).toBe(0);

    expect(read.result).toMatchObject({ status: "notFound", what: "challenges" });
  });

  it("keeps the day context's content and challenge date without an unsaved link", async () => {
    const fixture = await selectedCheckpointFixture();

    const read = await countDatabaseStatements(() =>
      loadPlanDayContext({ goal: fixture.goal, plan: fixture.view, scope: { activeGoal: true } }),
    );

    expect(read.writes).toBe(0);

    expect(read.result.challenges).toStrictEqual([]);

    expect(read.result.today?.items).toContainEqual(
      expect.objectContaining({
        kind: "lesson",
        title: fixture.view.week.days[0]?.items[0]?.title,
      }),
    );
  });
});
