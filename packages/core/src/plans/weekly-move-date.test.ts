import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "./_test-utils/plan-library";
import { changeGoalPlan } from "./change-goal-plan";
import { previewPlanChange } from "./preview-plan-change";

// Sunday in UTC is already Monday in Kiritimati: the bound must use the learner's local day.
const NOW = "2026-10-04T12:00:00Z";

describe("weekly move date", () => {
  afterEach(() => vi.useRealTimers());

  it.each(["checkpoint", "mock"] as const)(
    "refuses a %s moved within this week before planning or saving",
    async (kind) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(NOW));
      const user = await userFixture();

      const { goal, plan } = await unplannedGoalFixture({
        dailyMinutes: 60,
        timezone: "Pacific/Kiritimati",
        userId: user.id,
      });

      await planItemFixture({
        kind,
        minutes: 30,
        planId: plan.id,
        scheduledFor: new Date("2026-10-05"),
      });

      mockSession(user.id);

      const input = {
        operations: [{ from: "2026-10-05", kind: "moveWeeklyEvent" as const, to: "2026-10-06" }],
        timeZone: "Pacific/Kiritimati",
      };

      const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
      const beforeGoal = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

      await expect(changeGoalPlan({ goalId: goal.id, input })).resolves.toStrictEqual({
        error: "moveBeforeNextMonday",
        status: "invalid",
      });

      await expect(previewPlanChange({ goalId: goal.id, input })).resolves.toStrictEqual({
        error: "moveBeforeNextMonday",
        status: "invalid",
      });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toStrictEqual(before);

      await expect(
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ).resolves.toStrictEqual(beforeGoal);

      await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(0);
    },
  );

  it("accepts next Monday when UTC is already Monday but the learner is still on Sunday", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T01:00:00Z"));
    const user = await userFixture();

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 60,
      timezone: "America/Los_Angeles",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(
      changeGoalPlan({
        goalId: goal.id,
        input: {
          operations: [{ from: "2026-10-04", kind: "moveWeeklyEvent", to: "2026-10-05" }],
          timeZone: "America/Los_Angeles",
        },
      }),
    ).resolves.toStrictEqual({ change: null, status: "applied" });
  });
});
