import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { getGoalPlan, getGoalPlanScreen } from "./get-goal-plan";
import { getPlanTimeAdvice } from "./get-time-advice";
import { type buildPlan } from "./planner/build-plan";

/**
 * Plans laid out per read, counted at the planner's door: a build another build runs (a settling
 * pass) counts with the one that ran it.
 */
const builds = vi.hoisted(() => ({ depth: 0, laidOut: 0 }));

vi.mock("./planner/build-plan", async (importOriginal) => {
  const actual = await importOriginal<{ buildPlan: typeof buildPlan }>();

  return {
    ...actual,
    buildPlan: (...args: Parameters<typeof buildPlan>) => {
      if (builds.depth === 0) {
        builds.laidOut += 1;
      }

      builds.depth += 1;

      try {
        return actual.buildPlan(...args);
      } finally {
        builds.depth -= 1;
      }
    },
  };
});

async function countBuilds<Result>(read: () => Promise<Result>) {
  builds.laidOut = 0;
  const result = await read();
  return { builds: builds.laidOut, result };
}

describe("plans laid out per read", () => {
  it("reads Ana's exam plan and her time advice from her own plan, never searching other daily times", async () => {
    const copyKey = randomUUID();

    const user = await seedV2PersonaCopy({
      copyKey,
      email: `builds-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(user.userId);

    // Her plan and the estimates read from it: the plan she studies and the one its graph sizes.
    const screen = await countBuilds(() => getGoalPlanScreen(user.goalId));
    expect(screen.result.status).toBe("ready");
    expect.soft(screen.builds, "Plan screen").toBeLessThanOrEqual(2);

    const full = await countBuilds(() => getGoalPlan(user.goalId));
    expect(full.result.status).toBe("ready");
    expect.soft(full.builds, "the API's full plan").toBeLessThanOrEqual(2);

    // The time step: her plan at her time, then what another time she looks at covers.
    const own = await countBuilds(() => getPlanTimeAdvice({ goalId: user.goalId, input: {} }));
    expect(own.result.status).toBe("ready");
    expect.soft(own.builds, "time advice at her own time").toBeLessThanOrEqual(2);

    const other = await countBuilds(() =>
      getPlanTimeAdvice({ goalId: user.goalId, input: { dailyMinutes: 120 } }),
    );

    expect(other.result.status).toBe("ready");
    expect.soft(other.builds, "time advice at another time").toBeLessThanOrEqual(3);
  });
});
