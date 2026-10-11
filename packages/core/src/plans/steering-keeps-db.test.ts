import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { runSimLifeInDb } from "./_test-utils/sim/sim-db";
import { parsePlanChangePayload } from "./_utils/plan-change-payload";
import { createGoalPlan } from "./create-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

/** A Monday in 2020, before the learning events other tests write, which estimates read. */
const NOW = new Date("2020-09-28T12:00:00Z");

describe("asking to move the phase dates a run keeps", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /*
   * R40 (career seed 2131): a session's new pace laid the rest of the week out from the next day,
   * and Today's proposal to move the phase dates was planned again from today, whose time was still
   * open. There the lessons fit before their challenge with the same end, so the run asked nothing,
   * while the plan it saved held the challenge before its lessons.
   */
  it("asks to move a phase's end after a slower session, planned from the next day as its run was", async () => {
    const user = await userFixture();

    const library = await planLibraryFixture({
      phases: ["Basics", "Next steps"],
      skills: [{ lessons: 6 }, { lessons: 6, phase: 1 }],
    });

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 12,
      settings: { startDate: "2020-09-28" },
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);
    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

    // The learner finished today's lessons taking twice their estimate, long ago enough that no one
    // else's pace reads it: the rest of the week is laid out again from tomorrow.
    await prisma.planItem.updateMany({
      data: { completedAt: NOW, status: "done" },
      where: { kind: "lesson", planId: plan.id, scheduledFor: new Date("2020-09-28T00:00:00Z") },
    });

    await Promise.all(
      library.lessons.map((lesson) =>
        learningEventFixture({
          contentIds: { lessonId: lesson.id },
          endedAt: new Date("2001-01-01T12:00:00Z"),
          seconds: 360,
          userId: user.id,
        }),
      ),
    );

    await refreshGoalPlan({ goalId: goal.id, pace: "sampled" });

    const proposals = await prisma.planChange.findMany({
      where: { planId: plan.id, status: "proposed" },
    });

    expect(
      proposals.map((proposal) => parsePlanChangePayload(proposal.payload).effect?.phaseEnds),
    ).toStrictEqual([
      [{ after: expect.any(String), before: "2020-10-01", lessonsFirst: true, name: "Basics" }],
    ]);
  });

  /*
   * R40 (career seed 2107): the focus replaced Today's card to move the phase dates and kept the
   * dates, so the first phase's challenge stayed before two of its lessons with no card. Moving them
   * was planned with today's time open again, fitted those lessons before the challenge on paper,
   * and Today didn't ask. Moving them is planned as the change was (`askPhaseDatesAfterChange`).
   * Lived through the real capabilities: a plan built by hand didn't leave today's time to a focus.
   */
  it("asks again to move the phase dates after a focus, planned as the change was", async () => {
    const { violations } = await runSimLifeInDb(
      {
        dailyMinutes: 15,
        fixture: "career",
        knownAreas: [],
        mockOffers: "focus",
        pending: [4, 16, 25],
        seed: 2107,
        speed: 1.2,
        start: "2026-10-12",
        steps: [
          { finish: 1, kind: "study", misses: [] },
          { kind: "change", spec: { area: 2, kind: "focus" }, via: "buddy" },
        ],
        subscribed: false,
        targetInDays: 103,
      },
      { rules: ["R40"] },
    );

    expect(violations).toStrictEqual([]);
  });
});
