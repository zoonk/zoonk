import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadPlanContext } from "./_utils/plan-context";
import { computePlan } from "./_utils/replan";
import { createGoalPlan } from "./create-goal-plan";
import { parsePlanSettings } from "./planner/plan-state";
import { refreshGoalPlan } from "./refresh-goal-plan";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("saved mock funding and planner inputs", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("saves the inputs key for the funded settings the next run actually reads", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ area: "Math", lessons: 30 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 45,
      details: { placementDeclined: true },
      kind: "exam",
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-26"),
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(saved.settings).mockFunding.length).toBeGreaterThan(0);
    const context = await loadPlanContext({ goal });

    if (!context) {
      throw new Error("Expected saved funded plan");
    }

    const next = await computePlan({ context, mode: "forced" });
    expect(next.inputsKey).toBe(saved.inputsKey);

    await expect(refreshGoalPlan({ goalId: goal.id })).resolves.toMatchObject({
      status: "unchanged",
    });

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      saved,
    );
  });
});
