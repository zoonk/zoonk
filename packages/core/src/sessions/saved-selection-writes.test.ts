import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { markLearnerChanged, markPlansChanged } from "../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import * as replan from "../plans/_utils/replan";
import { createGoalPlan } from "../plans/create-goal-plan";
import { ensureStudySession } from "./ensure-study-session";
import { openStudyDay, openStudySession } from "./open-study-day";

const NOW = new Date("2020-09-28T12:00:00Z");

describe("Start and Continue save a fresh selection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("Continue saves changed content inputs while keeping a started block", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ lessons: 10 }] }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 20,
      details: { placementDeclined: true },
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);

    const opened = await openStudyDay({
      goalId: goal.id,
      shownDate: "2020-09-28",
      timeZone: "UTC",
    });

    if (opened.status !== "opened") {
      throw new Error("Expected the day");
    }

    const block = await prisma.studySessionBlock.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { kind: "learn", sessionId: opened.sessionId },
    });

    await prisma.studySessionBlock.update({
      data: { startedAt: NOW, status: "active" },
      where: { id: block.id },
    });

    const kept = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    await prisma.$transaction(async (tx) => {
      await markPlansChanged(tx, { planIds: [plan.id] });

      await tx.lesson.update({
        data: { estimatedMinutes: 12 },
        where: { id: library.lessons.at(-1)?.id },
      });
    });

    await expect(
      openStudySession({ input: { timeZone: "UTC" }, sessionId: opened.sessionId }),
    ).resolves.toMatchObject({ status: "ready" });

    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(saved.inputsKey).not.toBe(before.inputsKey);
    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: opened.sessionId } }),
    ).resolves.toMatchObject({ planVersion: saved.version });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(kept);
  });

  it("a challenge's Start retries its stale session selection from fresh inputs", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ lessons: 10 }] }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 20,
      details: { placementDeclined: true },
      settings: { startDate: "2020-09-28" },
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    mockSession(user.id);
    const compute = replan.computePlan;
    const minutes: number[] = [];

    vi.spyOn(replan, "computePlan").mockImplementation((async (input) => {
      minutes.push(input.context.goal.dailyMinutes);
      const computed = await compute(input);

      if (minutes.length === 1) {
        await prisma.$transaction(async (tx) => {
          await markLearnerChanged(tx, { planInputs: true, userId: user.id });
          await tx.goal.update({ data: { dailyMinutes: 5 }, where: { id: goal.id } });
        });
      }

      return computed;
    }) as typeof compute);

    const session = await ensureStudySession({
      goal,
      localDate: new Date("2020-09-28"),
      timeZone: "UTC",
      userId: user.id,
    });

    expect(session.goalId).toBe(goal.id);
    expect(session.plannedMinutes).toBeGreaterThan(0);
    expect(session.plannedMinutes).toBeLessThanOrEqual(5);
    expect(minutes).toStrictEqual([20, 5]);
    const saved = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(saved.summary).toMatchObject({ basis: { layoutInputVersion: saved.inputVersion } });
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });
});
