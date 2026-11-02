import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getGoalPlan } from "../plans/get-goal-plan";
import { openTodayView } from "./_test-utils/open-today-view";
import { readBlockPayload } from "./block-payload";

const START = new Date("2020-09-28T12:00:00Z");
const DAY_MILLISECONDS = 86_400_000;

describe("a low-pace course's fixed checkpoint budget", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
  });

  afterEach(() => vi.useRealTimers());

  it.each([10, 15, 30])(
    "shows the real boss-day budget at %i minutes a day",
    async (dailyMinutes) => {
      const [user, library] = await Promise.all([
        userFixture(),
        planLibraryFixture({ skills: [{ lessons: 12 }] }),
      ]);

      const { goal, plan } = await unplannedGoalFixture({
        createdAt: START,
        dailyMinutes,
        details: { placementDeclined: true },
        kind: "learn",
        settings: {
          startDate: "2020-09-28",
          weekdayMinutes: [
            0,
            dailyMinutes,
            dailyMinutes,
            dailyMinutes,
            dailyMinutes,
            dailyMinutes,
            0,
          ],
        },
        timezone: "UTC",
        userId: user.id,
      });

      await Promise.all([
        prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        }),
        ...Array.from({ length: 10 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
        ),
      ]);

      mockSession(user.id);

      await expect(
        createGoalPlan({ goalId: goal.id, graph: library.graph }),
      ).resolves.toMatchObject({ status: "created" });

      const boss = await prisma.planItem.findFirstOrThrow({
        orderBy: { position: "asc" },
        where: { kind: "boss", planId: plan.id },
      });

      if (!boss.scheduledFor) {
        throw new Error("Expected the course's scheduled boss");
      }

      await Promise.all([
        prisma.planItem.updateMany({
          data: { completedAt: START, status: "done" },
          where: { kind: "lesson", planId: plan.id },
        }),
        studySessionFixture({
          endedAt: new Date(boss.scheduledFor.getTime() - DAY_MILLISECONDS),
          goalId: goal.id,
          localDate: new Date(boss.scheduledFor.getTime() - DAY_MILLISECONDS),
          plannedMinutes: dailyMinutes,
          status: "completed",
          userId: user.id,
        }),
      ]);

      vi.setSystemTime(new Date(boss.scheduledFor.getTime() + DAY_MILLISECONDS / 2));

      await expect(
        getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
      ).resolves.toMatchObject({
        challenge: { estimatedMinutes: 15, questions: 10 },
        status: "ready",
      });

      const today = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

      if (today.status !== "ready") {
        throw new Error("Expected the explicitly opened checkpoint day");
      }

      const session = await prisma.studySession.findUniqueOrThrow({
        include: { blocks: true },
        where: { id: today.today.session.id },
      });

      const block = session.blocks.find((entry) => readBlockPayload(entry).planItemId === boss.id);
      expect(block?.estimatedMinutes).toBe(15);
      const plannedMinutes = Math.max(dailyMinutes, 15);
      expect(today.today.session.minutes.dailyGoal).toBe(plannedMinutes);
      expect(session.plannedMinutes).toBeLessThanOrEqual(today.today.session.minutes.dailyGoal);

      const view = await getGoalPlan(goal.id);

      if (view.status !== "ready") {
        throw new Error(`Expected the boss-day Plan: ${view.status}`);
      }

      expect(
        view.plan.week.days.find(
          (day) => day.date === boss.scheduledFor?.toISOString().slice(0, 10),
        )?.minutes,
      ).toBe(plannedMinutes);
    },
  );

  it("shows a whole weekly checkpoint's fifteen minutes on a ten-minute study day", async () => {
    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({ skills: [{ lessons: 30 }] }),
    ]);

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: START,
      dailyMinutes: 10,
      details: { placementDeclined: true },
      kind: "learn",
      settings: { startDate: "2020-09-28", weekdayMinutes: [0, 10, 10, 10, 10, 10, 0] },
      timezone: "UTC",
      userId: user.id,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    const questions = await Promise.all(
      Array.from({ length: 10 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: library.skills[0]?.id ?? "" }),
      ),
    );

    mockSession(user.id);

    await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
      status: "created",
    });

    const weekly = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { kind: "checkpoint", planId: plan.id },
    });

    if (!weekly.scheduledFor) {
      throw new Error("Expected the course's actual weekly checkpoint");
    }

    const previous = new Date(weekly.scheduledFor.getTime() - DAY_MILLISECONDS);

    await Promise.all([
      ...questions.map((question) =>
        attemptFixture({
          answeredAt: previous,
          itemId: question.id,
          skillId: question.skillId,
          userId: user.id,
        }),
      ),
      prisma.planItem.updateMany({
        data: { completedAt: previous, status: "done" },
        where: { kind: "lesson", planId: plan.id, scheduledFor: { lt: weekly.scheduledFor } },
      }),
      studySessionFixture({
        endedAt: previous,
        goalId: goal.id,
        localDate: previous,
        plannedMinutes: 10,
        status: "completed",
        userId: user.id,
      }),
    ]);

    vi.setSystemTime(new Date(weekly.scheduledFor.getTime() + DAY_MILLISECONDS / 2));
    const result = await openTodayView({ goalId: goal.id, timeZone: "UTC" });

    if (result.status !== "ready") {
      throw new Error("Expected the explicitly opened weekly checkpoint day");
    }

    const session = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true },
      where: { id: result.today.session.id },
    });

    const block = session.blocks.find((entry) => readBlockPayload(entry).planItemId === weekly.id);
    expect(block?.estimatedMinutes).toBe(15);
    expect(session.plannedMinutes).toBe(15);
    expect(result.today.session.minutes.dailyGoal).toBe(15);
  });
});
