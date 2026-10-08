import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayStudySession } from "./get-today-study-session";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** A Monday in 2020, before the learning events other tests write, so their pace stays out. */
const MONDAY = new Date("2020-09-28T12:00:00Z");
const THURSDAY = new Date("2020-10-01T12:00:00Z");

describe("building today's session from a plan with missed days", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MONDAY);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("re-flows the plan first without clearing caches, which a render can't do", async () => {
    const user = await userFixture();
    const library = await planLibraryFixture({ skills: [{ lessons: 8 }, { lessons: 6 }] });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    vi.setSystemTime(THURSDAY);
    vi.mocked(revalidateTag).mockClear();
    const finishDeferredWork = runDeferredWork();

    // Opening Today on Thursday builds the day: Monday to Wednesday were missed.
    const result = await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });
    await finishDeferredWork();

    expect(result.status).toBe("ready");

    const changes = await prisma.planChange.findMany({ where: { planId: plan.id } });
    expect(changes).toMatchObject([{ kind: "missedDays" }]);

    // Next.js throws when a render (or its prefetch) clears caches, even from `after()`, and the
    // plan's tags only tag private reads that no server keeps, so nothing is cleared, then or later.
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
