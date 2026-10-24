import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";

const NOW = new Date("2020-09-28T12:00:00Z");

async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    skills: Array.from({ length: 3 }, () => ({ lessons: 0, size: 12 })),
  });

  const { goal } = await unplannedGoalFixture({
    dailyMinutes: 5,
    settings: { startDate: "2020-09-28" },
    targetDate: new Date("2020-10-02T00:00:00Z"),
    userId: user.id,
  });

  mockSession(user.id);
  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  return { goal, user };
}

describe("the plan read", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    vi.mocked(getRequestProgressDateContext).mockResolvedValue({
      currentDate: new Date("2020-09-28T00:00:00Z"),
      currentInstant: NOW,
      timeZone: "UTC",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the exact plan the API and the screens show, with no searched time", async () => {
    const { goal, user } = await setup();
    vi.mocked(cacheTag).mockClear();
    const full = await getGoalPlan(goal.id);
    const fullTags = vi.mocked(cacheTag).mock.calls;

    expect(full.status).toBe("ready");

    if (full.status !== "ready" || !full.plan.feasibility) {
      throw new Error("Expected the plan with deadline feasibility");
    }

    expect(full.plan.feasibility.coreFits).toBe(false);

    // The time that brings every topic in plans the goal at each daily time, so only the learner's
    // own request works it out (see `findPlanTimeToCover`), and no read carries it.
    for (const field of ["coreMinutes", "recommendedMinutes", "fittingDate"]) {
      expect(full.plan.feasibility).not.toHaveProperty(field);
    }

    // The read's own cache is tagged by the learner's goals and model; the plan analysis under it
    // is keyed by its complete input instead, untagged, so a write that changes nothing it reads
    // keeps it.
    expect(fullTags.flat()).toStrictEqual(
      expect.arrayContaining([getGoalsCacheTag(user.id), getLearnerModelCacheTag(user.id)]),
    );
  });

  it("says what's missing and whose it is", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(getGoalPlan(crypto.randomUUID())).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);
    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
