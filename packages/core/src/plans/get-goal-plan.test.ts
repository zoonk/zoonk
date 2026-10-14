import { userFixture } from "@zoonk/testing/fixtures/users";
import { cacheTag } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getGoalsCacheTag, getLearnerModelCacheTag } from "../cache/tags";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan, getGoalPlanScreen } from "./get-goal-plan";

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

describe("plan read projections", () => {
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

  it("keeps the exact public core recommendation while screens omit only that unused field", async () => {
    const { goal, user } = await setup();
    vi.mocked(cacheTag).mockClear();
    const full = await getGoalPlan(goal.id);
    const fullTags = vi.mocked(cacheTag).mock.calls;
    vi.mocked(cacheTag).mockClear();
    const screen = await getGoalPlanScreen(goal.id);

    expect(full.status).toBe("ready");
    expect(screen.status).toBe("ready");

    if (full.status !== "ready" || screen.status !== "ready" || !full.plan.feasibility) {
      throw new Error("Expected both plan projections with deadline feasibility");
    }

    expect(full.plan.feasibility.coreFits).toBe(false);
    expect(full.plan.feasibility.coreMinutes).toBeGreaterThan(5);
    const { coreMinutes: _coreMinutes, ...feasibility } = full.plan.feasibility;

    expect(screen.plan).toStrictEqual({ ...full.plan, feasibility });
    expect(screen.plan.feasibility).not.toHaveProperty("coreMinutes");
    expect(vi.mocked(cacheTag).mock.calls).toStrictEqual(fullTags);
    expect(fullTags).toContainEqual([getGoalsCacheTag(user.id), getLearnerModelCacheTag(user.id)]);
  });

  it("uses the same missing and ownership outcomes for both projections", async () => {
    const { goal } = await setup();
    const other = await userFixture();
    mockSession(other.id);

    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(getGoalPlanScreen(goal.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(getGoalPlan(crypto.randomUUID())).resolves.toStrictEqual({ status: "notFound" });

    await expect(getGoalPlanScreen(crypto.randomUUID())).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);
    await expect(getGoalPlan(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });
    await expect(getGoalPlanScreen(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
