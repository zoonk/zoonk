import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { createLessonQuestion } from "../lesson-questions/create-lesson-question";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { getPlanBasesAdvice } from "./get-bases-advice";
import { getGoalPlan, getGoalPlanScreen } from "./get-goal-plan";
import { findPlanTimeToCover, getPlanTimeAdvice } from "./get-time-advice";
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
  it("reads Ana's exam plan, her time advice and a buddy turn from her own plan, never searching other daily times", async () => {
    const copyKey = randomUUID();

    const user = await seedV2PersonaCopy({
      copyKey,
      email: `builds-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(user.userId);

    // Her plan and what her own time covers: the plan she studies, the one its graph sizes, and,
    // when that one is whole, the plan her own time plans once switched to (`timeCovers`).
    const screen = await countBuilds(() => getGoalPlanScreen(user.goalId));
    expect(screen.result.status).toBe("ready");
    expect.soft(screen.builds, "Plan screen").toBeLessThanOrEqual(3);

    const full = await countBuilds(() => getGoalPlan(user.goalId));
    expect(full.result.status).toBe("ready");
    expect.soft(full.builds, "the API's full plan").toBeLessThanOrEqual(3);

    // The time step: her plan at her time, then what another time she looks at covers.
    const own = await countBuilds(() => getPlanTimeAdvice({ goalId: user.goalId, input: {} }));
    expect(own.result.status).toBe("ready");
    expect.soft(own.builds, "time advice at her own time").toBeLessThanOrEqual(2);

    const other = await countBuilds(() =>
      getPlanTimeAdvice({ goalId: user.goalId, input: { dailyMinutes: 120 } }),
    );

    expect(other.result.status).toBe("ready");
    expect.soft(other.builds, "time advice at another time").toBeLessThanOrEqual(3);

    // A buddy turn that isn't about time reads her plan as the screens do: it builds the turn's
    // context and runs no search (the time that covers everything is the buddy's `timeToCover`
    // lookup, only for a question about time).
    const turn = await countBuilds(() =>
      createLessonQuestion({
        input: { context: { kind: "plan" }, question: "What's next?", requestId: randomUUID() },
        target: { goalId: user.goalId, kind: "plan" },
      }),
    );

    expect(turn.result.status).toBe("created");
    expect.soft(turn.builds, "a buddy turn not about time").toBeLessThanOrEqual(3);

    // Where the searches went: only when she asks, each a POST of its own.
    const found = await countBuilds(() => findPlanTimeToCover({ goalId: user.goalId, input: {} }));

    expect(found.result.status).toBe("ready");
    expect(found.builds, "Find searches other daily times").toBeGreaterThan(screen.builds);

    const advice = await countBuilds(() => getPlanBasesAdvice(user.goalId));
    expect(advice.result.status).toBe("ready");
  });
});
