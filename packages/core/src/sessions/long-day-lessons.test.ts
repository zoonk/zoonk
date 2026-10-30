import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { MAX_DAILY_MINUTES } from "../plans/daily-minutes";
import { getLearningShare } from "../plans/planner/plan-phases";
import { getTodayView } from "../view-models/today/get-today-view";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, SESSION_TODAY, sessionGoalFixture } from "./_test-utils/session-goal";
import { planStudyDay } from "./_utils/plan-study-day";
import { readSavedDayPlan } from "./_utils/selected-day-plan";

describe("a long study day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("studies as many of the plan's lessons as two hours hold, not only the first few", async () => {
    const user = await userFixture();

    const { goal, lessons } = await sessionGoalFixture({
      goal: { dailyMinutes: 120 },
      itemsPerSkill: 1,
      lessons: 30,
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const learnLessons = result.session.blocks.flatMap((block) =>
      block.kind === "learn" ? [block.lessonId] : [],
    );

    expect(learnLessons.length).toBeGreaterThan(8);

    expect(learnLessons).toStrictEqual(
      lessons.slice(0, learnLessons.length).map((lesson) => lesson.id),
    );
  });

  it("fills a first half-hour with ten 3-minute lessons, not the eight a 4-minute guess holds", async () => {
    const user = await userFixture();

    const { goal, lessons } = await sessionGoalFixture({
      goal: { dailyMinutes: 30 },
      itemsPerSkill: 1,
      lessons: 20,
      userId: user.id,
    });

    await Promise.all([
      prisma.lesson.updateMany({
        data: { estimatedMinutes: 3 },
        where: { id: { in: lessons.map((lesson) => lesson.id) } },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const learn = result.session.blocks.filter((block) => block.kind === "learn");

    expect(learn).toHaveLength(10);
    expect(learn.reduce((sum, block) => sum + block.estimatedMinutes, 0)).toBe(30);
  });

  it("loads no more lessons than a day's minutes hold for a learner back to a long overdue backlog", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { dailyMinutes: 15 },
      itemsPerSkill: 1,
      lessons: 60,
      userId: user.id,
    });

    await prisma.planItem.updateMany({
      data: { scheduledFor: new Date("2026-09-01T00:00:00Z") },
      where: { kind: "lesson", planId: plan.id },
    });

    const saved = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    const selection = await readSavedDayPlan({ goal: saved, now: SESSION_NOW, timeZone: "UTC" });

    if (!selection) {
      throw new Error("Expected the saved plan's day");
    }

    const day = await planStudyDay({
      blueprint: null,
      goal: saved,
      localDate: SESSION_TODAY,
      now: SESSION_NOW,
      selection,
      timeZone: "UTC",
      userId: user.id,
    });

    expect(day.input.lessons.length).toBeGreaterThan(0);
    expect(day.input.lessons.length).toBeLessThanOrEqual(15);
  });

  it("reads Today for a learner a long backlog behind without loading every lesson it holds", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { dailyMinutes: 15 },
      itemsPerSkill: 1,
      lessons: 160,
      userId: user.id,
    });

    // Studying yesterday, even another goal, keeps Today from a welcome back that hides catch-up.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { scheduledFor: new Date("2026-09-01T00:00:00Z") },
        where: { kind: "lesson", planId: plan.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      learningEventFixture({ endedAt: new Date("2026-09-29T12:00:00Z"), userId: user.id }),
    ]);

    mockSession(user.id);

    const read = await countDatabaseRows(
      () => getTodayView({ goalId: goal.id, timeZone: "UTC" }),
      `"library_lessons"."title"`,
    );

    if (read.result.status !== "ready") {
      throw new Error(`Expected Today, got ${read.result.status}`);
    }

    expect(read.result.today.session.catchUp?.later).toStrictEqual({
      lessons: 157,
      minutes: 628,
      offered: false,
    });

    expect(read.rows).toBeLessThanOrEqual(30);
  });

  it("gives lessons the learn share of a whole day the learner gives, as the week counts the day", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { dailyMinutes: MAX_DAILY_MINUTES },
      itemsPerSkill: 1,
      lessons: 400,
      userId: user.id,
    });

    // A plan's first day is all lessons; this one began the day before.
    await Promise.all([
      prisma.plan.update({
        data: { settings: { startDate: "2026-09-29" } },
        where: { id: plan.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const lessonMinutes = result.session.blocks
      .filter((block) => block.kind === "learn")
      .reduce((sum, block) => sum + block.estimatedMinutes, 0);

    const today = result.session.week.days.find((day) => day.isToday);
    const share = getLearningShare({ phaseKind: "learn", practiceBias: "balanced" });

    expect(lessonMinutes).toBe(MAX_DAILY_MINUTES * share);
    expect(today?.goalMinutes).toBe(MAX_DAILY_MINUTES);
  });
});
