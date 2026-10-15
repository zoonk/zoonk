import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { keepPaceOwn } from "./_test-utils/sim/sim-db-pace";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlanAssessment } from "./get-goal-plan-assessment";
import { readPlanHeadline } from "./plan-assessment-contract";
import * as producer from "./planner/build-plan";

const NOW = new Date("2026-10-12T12:00:00Z");

async function setup() {
  const [user, library] = await Promise.all([
    userFixture(),
    planLibraryFixture({ skills: [{ lessons: 4 }, { lessons: 3 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: NOW,
    dailyMinutes: 20,
    settings: { startDate: "2026-10-12" },
    targetDate: new Date("2026-11-30"),
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  return { goal, plan, user };
}

describe(getGoalPlanAssessment, () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    await keepPaceOwn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reads where the stored plan stands without planning or writing anything", async () => {
    const { goal } = await setup();
    const builds = vi.spyOn(producer, "buildPlan");

    const { result, writes } = await countDatabaseStatements(() => getGoalPlanAssessment(goal.id));

    expect(builds).not.toHaveBeenCalled();
    expect(writes).toBe(0);
    expect(result.status).toBe("ready");

    const assessment = result.status === "ready" ? result.assessment : null;

    expect(assessment).toMatchObject({
      asOf: { layoutStudyDay: "2026-10-12" },
      fit: { verdict: "fits" },
      lifecycle: null,
      pace: { kind: "onPace" },
      pending: null,
    });

    expect(assessment && readPlanHeadline(assessment)).toStrictEqual({
      kind: "pace",
      pace: { kind: "onPace" },
    });
  });

  it("never says a plan that may not reflect its inputs fits", async () => {
    const { goal, plan } = await setup();

    await prisma.$transaction(async (tx) => {
      await markPlansChanged(tx, { planIds: [plan.id] });
      await tx.plan.update({ data: { pendingAdaptation: ["content"] }, where: { id: plan.id } });
    });

    const result = await getGoalPlanAssessment(goal.id);

    expect(result).toMatchObject({
      assessment: { fit: { verdict: "pending" }, pending: { legacy: false, reasons: ["content"] } },
      status: "ready",
    });
  });

  it("reads a plan saved before its summary described it as pending", async () => {
    const { goal, plan } = await setup();
    await prisma.plan.update({ data: { summary: { schemaVersion: 1 } }, where: { id: plan.id } });

    await expect(getGoalPlanAssessment(goal.id)).resolves.toMatchObject({
      assessment: {
        asOf: null,
        fit: { coverage: null, verdict: "pending" },
        pending: { legacy: true },
      },
      status: "ready",
    });
  });

  it("reads only the learner's own goals", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    const theirs = await goalFixture({ userId: other.id });

    await expect(getGoalPlanAssessment(theirs.id)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);
    await expect(getGoalPlanAssessment(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
