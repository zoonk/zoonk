import { planChangeFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { loadTodayPlanChange } from "./_utils/today-plan-change";
import { createGoalPlan } from "./create-goal-plan";
import { PHASE_DATES_SOURCE } from "./plan-change-contract";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

/** Far enough for every lesson: keeping the phase dates costs nothing. */
const TARGET = new Date("2020-12-31T00:00:00Z");

/** A dated learn plan of two phases that fits its date as it is. */
async function setup() {
  const user = await userFixture();

  const library = await planLibraryFixture({
    phases: ["Basics", "Projects"],
    skills: [
      { area: "Math", lessons: 4, phase: 0 },
      { area: "Math", lessons: 4, phase: 1 },
    ],
  });

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 12,
    settings: { startDate: "2020-09-28" },
    targetDate: TARGET,
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);

  return { goal, plan };
}

/*
 * Pedro's Today offered to move his phase dates, "the challenge fell on a day without room", with
 * Apply and no diff: the proposal was planned from another day, and moving the dates no longer did
 * anything by the time he read it (his challenge was already in today's session). Today previews a
 * proposal against the plan as it is now; one whose preview changes nothing isn't offered.
 */
describe("a proposal whose preview no longer changes anything", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isn't offered on Today, and the change before it still is", async () => {
    const { goal, plan } = await setup();

    const missed = await planChangeFixture({
      createdAt: new Date(NOW.getTime() - 60 * 60 * 1000),
      kind: "coverageChanged",
      payload: {
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsRemoved: 0,
          topicsAdded: [{ area: "Math", topics: ["Fractions"] }],
        },
        source: "system",
      },
      planId: plan.id,
      status: "applied",
    });

    // Planned on another day, it moved nothing the learner could see by now.
    await planChangeFixture({
      kind: "edited",
      payload: {
        effect: {
          endDateAfter: "2020-12-31",
          endDateBefore: "2020-12-31",
          lessonsAdded: 1,
          lessonsRemoved: 0,
          phaseEnds: [],
        },
        operations: [{ kind: "fitPhaseDates" }],
        source: PHASE_DATES_SOURCE,
      },
      planId: plan.id,
      reason: "",
      status: "proposed",
    });

    await expect(loadTodayPlanChange({ goal, now: NOW, timeZone: "UTC" })).resolves.toMatchObject({
      id: missed.id,
      status: "applied",
    });
  });
});
