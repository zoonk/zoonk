import { randomUUID } from "node:crypto";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { createLessonQuestion } from "../lesson-questions/create-lesson-question";
import { seedPersonaCopy } from "../seed/seed";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createSetUpGoalPlan } from "./_test-utils/set-up-plan";
import { getGoalPlan } from "./get-goal-plan";
import { findPlanTimeToCover, getPlanTimeAdvice } from "./get-time-advice";
import * as planner from "./planner/build-plan";

const SEARCH_STEP_MINUTES = 5;

/** Trying every daily time with the floor at 0 finds this same time. */
const ANA_WEEKDAY_MINUTES = 145;

async function countBuilds<Result>(read: () => Promise<Result>) {
  const builds = vi.spyOn(planner, "buildPlan");
  builds.mockClear();
  const result = await read();
  return { builds: builds.mock.calls.length, result };
}

describe("plans laid out per read", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("reads Ana's exam plan, her time advice and a buddy turn from her own plan, never searching other daily times", async () => {
    const copyKey = randomUUID();

    const user = await seedPersonaCopy({
      copyKey,
      email: `builds-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(user.userId);

    const plan = await countBuilds(() => getGoalPlan(user.goalId));
    expect(plan.result.status).toBe("ready");
    expect.soft(plan.builds, "Plan").toBeLessThanOrEqual(3);

    const own = await countBuilds(() => getPlanTimeAdvice({ goalId: user.goalId, input: {} }));
    expect(own.result.status).toBe("ready");
    expect(own.builds, "time advice plans her week").toBeGreaterThan(0);
    expect.soft(own.builds, "time advice at her own time").toBeLessThanOrEqual(2);

    const other = await countBuilds(() =>
      getPlanTimeAdvice({ goalId: user.goalId, input: { dailyMinutes: 120 } }),
    );

    expect(other.result.status).toBe("ready");
    expect.soft(other.builds, "time advice at another time").toBeLessThanOrEqual(3);

    const turn = await countBuilds(() =>
      createLessonQuestion({
        input: { context: { kind: "plan" }, question: "What's next?", requestId: randomUUID() },
        target: { goalId: user.goalId, kind: "plan" },
      }),
    );

    expect(turn.result.status).toBe("created");
    expect.soft(turn.builds, "a buddy turn not about time").toBeLessThanOrEqual(3);
  });

  it("finds the time that covers Ana's exam without planning every time under it, and finds the same one", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T15:00:00Z"));
    const copyKey = randomUUID();

    const user = await seedPersonaCopy({
      copyKey,
      email: `floor-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    mockSession(user.userId);

    const found = await countBuilds(() =>
      findPlanTimeToCover({ goalId: user.goalId, input: { studyDays: [1, 2, 3, 4, 5] } }),
    );

    expect(found.result).toMatchObject({
      status: "ready",
      time: { recommendedMinutes: ANA_WEEKDAY_MINUTES },
    });

    expect(found.builds).toBeLessThan(ANA_WEEKDAY_MINUTES / SEARCH_STEP_MINUTES / 2);
  });

  it("finds no time for a date that has passed without searching every daily time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2020-09-28T12:00:00Z"));

    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 6 }, { lessons: 6 }] });

    const { goal } = await unplannedGoalFixture({
      dailyMinutes: 5,
      details: { placementDeclined: true },
      settings: { startDate: "2020-09-28" },
      targetDate: new Date("2020-10-19T00:00:00Z"),
      timezone: "UTC",
      userId: user.id,
    });

    await createSetUpGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    vi.setSystemTime(new Date("2020-10-20T12:00:00Z"));

    const found = await countBuilds(() =>
      findPlanTimeToCover({ goalId: goal.id, input: { studyDays: [1, 2, 3, 4, 5] } }),
    );

    vi.useRealTimers();

    expect(found.result).toMatchObject({
      status: "ready",
      time: { recommendedMinutes: null, suggested: null, targetDate: "2020-10-19" },
    });

    expect(found.builds).toBeLessThanOrEqual(2);
  });
});
