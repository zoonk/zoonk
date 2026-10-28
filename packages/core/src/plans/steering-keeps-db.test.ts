import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import { getTodayView } from "../view-models/today/get-today-view";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
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

  it("moves a phase's end after a slower session and records it, quietly on Today", async () => {
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

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "boss", phase: 0, planId: plan.id } }),
    ).resolves.toMatchObject({ scheduledFor: new Date("2020-10-01") });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);
    await getTodayStudySession({ goalId: goal.id, timeZone: "UTC" });

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

    expect(proposals).toStrictEqual([]);

    const boss = await prisma.planItem.findFirstOrThrow({
      where: { kind: "boss", phase: 0, planId: plan.id },
    });

    expect(boss.scheduledFor).toStrictEqual(new Date("2020-10-02"));

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({
      challenge: { date: "2020-10-02", planItemId: boss.id, status: "upcoming" },
      status: "ready",
    });

    const applied = await prisma.planChange.findFirstOrThrow({
      where: { kind: "estimateUpdated", planId: plan.id, status: "applied" },
    });

    const phaseEnds = [
      { after: "2020-10-02", before: "2020-10-01", lessonsFirst: true, name: "Basics" },
    ];

    const payload = parsePlanChangePayload(applied.payload);
    expect(payload.source).toBe("system");
    expect(payload.effect).toMatchObject({ lessonsAdded: 0, lessonsRemoved: 0 });
    expect(payload.effect?.phaseEnds).toStrictEqual(phaseEnds);

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      status: "ready",
      today: { planChange: null },
    });
  });
});
