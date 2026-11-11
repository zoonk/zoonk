import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import {
  SESSION_NOW,
  SESSION_TODAY,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getStudySession } from "../sessions/get-study-session";
import { getPlanTabView } from "../view-models/plan/get-plan-view";
import { getTodayView } from "../view-models/today/get-today-view";

const MONDAY = new Date("2026-10-12T00:00:00Z");
const TUESDAY = new Date("2026-10-13T00:00:00Z");
const FRIDAY = new Date("2026-10-16T00:00:00Z");

function studied({
  goalId,
  localDate,
  seconds,
  userId,
}: {
  goalId: string;
  localDate: Date;
  seconds: number;
  userId: string;
}) {
  return learningEventFixture({ goalId, localDate, seconds, userId });
}

describe("weekly study time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts only the goal's own time, budget and dates on Plan and Today, without daily rounding loss", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T14:00:00Z"));
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [2], userId: user.id });

    const second = await goalFixture({
      createdAt: MONDAY,
      dailyMinutes: 10,
      targetDate: new Date("2026-10-17T00:00:00Z"),
      userId: user.id,
    });

    await Promise.all([
      prisma.goal.update({
        data: { createdAt: MONDAY, dailyMinutes: 45, timezone: "UTC" },
        where: { id: goal.id },
      }),
      prisma.plan.update({
        data: { settings: { weekdayMinutes: [0, 45, 45, 45, 45, 45, 0] } },
        where: { goalId: goal.id },
      }),
      planFixture({ goalId: second.id, settings: { weekdayMinutes: [0, 10, 10, 10, 10, 10, 0] } }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studied({ goalId: goal.id, localDate: MONDAY, seconds: 1831, userId: user.id }),
      studied({ goalId: goal.id, localDate: TUESDAY, seconds: 1831, userId: user.id }),
      learningEventFixture({
        goalId: goal.id,
        kind: "session",
        localDate: TUESDAY,
        seconds: 1831,
        userId: user.id,
      }),
      studied({ goalId: second.id, localDate: TUESDAY, seconds: 1200, userId: user.id }),
      studied({
        goalId: goal.id,
        localDate: new Date("2026-10-11T00:00:00Z"),
        seconds: 3600,
        userId: user.id,
      }),
    ]);

    await studySessionFixture({ goalId: goal.id, localDate: TUESDAY, userId: user.id });
    mockSession(user.id);

    const [planView, today] = await Promise.all([
      getPlanTabView(),
      getTodayView({ goalId: goal.id }),
    ]);

    expect(planView).toMatchObject({
      status: "ready",
      view: { plan: { weekTime: { studiedMinutes: 61, targetMinutes: 225 } } },
    });

    if (today.status !== "ready") {
      throw new Error(`Expected ready Today, received ${today.status}`);
    }

    expect(today.today.session.week).not.toHaveProperty("time");

    expect(
      today.today.session.week.days.map(({ goalMinutes, kind, minutes }) => ({
        goalMinutes,
        kind,
        minutes,
      })),
    ).toStrictEqual([
      { goalMinutes: 45, kind: "study", minutes: 30 },
      { goalMinutes: 45, kind: "study", minutes: 30 },
      { goalMinutes: 45, kind: "study", minutes: 0 },
      { goalMinutes: 45, kind: "study", minutes: 0 },
      { goalMinutes: 45, kind: "study", minutes: 0 },
      { goalMinutes: 0, kind: "rest", minutes: 0 },
      { goalMinutes: 0, kind: "rest", minutes: 0 },
    ]);
  });

  it("marks a day done only when this goal's session finished, not another goal's", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T14:00:00Z"));
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const second = await goalFixture({ createdAt: MONDAY, dailyMinutes: 10, userId: user.id });

    await Promise.all([
      prisma.goal.update({
        data: { createdAt: MONDAY, dailyMinutes: 45, timezone: "UTC" },
        where: { id: goal.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studySessionFixture({
        endedAt: new Date("2026-10-12T12:00:00Z"),
        goalId: second.id,
        localDate: MONDAY,
        status: "completed",
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const today = await getTodayView({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error(`Expected ready Today, received ${today.status}`);
    }

    expect(today.today.session.week.days[0]).toMatchObject({
      date: MONDAY,
      hitGoal: false,
      studied: false,
    });
  });

  it("keeps the learner's local week and shows all time studied above its target", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T04:00:00Z"));
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const sunday = new Date("2026-10-11T00:00:00Z");

    await Promise.all([
      prisma.goal.update({
        data: {
          createdAt: new Date("2026-10-05T12:00:00Z"),
          dailyMinutes: 1,
          timezone: "Pacific/Honolulu",
        },
        where: { id: goal.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studied({ goalId: goal.id, localDate: sunday, seconds: 3662, userId: user.id }),
      studied({ goalId: goal.id, localDate: MONDAY, seconds: 3600, userId: user.id }),
    ]);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: sunday,
      userId: user.id,
    });

    mockSession(user.id);

    const [planView, sessionView] = await Promise.all([
      getPlanTabView(),
      getStudySession({ input: {}, sessionId: session.id }),
    ]);

    expect(planView).toMatchObject({
      status: "ready",
      view: { plan: { weekTime: { studiedMinutes: 61, targetMinutes: 7 } } },
    });

    if (sessionView.status !== "ready") {
      throw new Error(`Expected a ready session, received ${sessionView.status}`);
    }

    expect(sessionView.session.week.days.at(-1)).toMatchObject({ date: sunday, minutes: 61 });
  });

  it("shows the new current week while Sunday's unfinished session carries into Monday", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T00:10:00Z"));
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });
    const sunday = new Date("2026-10-11T00:00:00Z");

    await Promise.all([
      prisma.goal.update({
        data: { createdAt: new Date("2026-10-05T00:00:00Z"), dailyMinutes: 45, timezone: "UTC" },
        where: { id: goal.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studied({ goalId: goal.id, localDate: sunday, seconds: 3600, userId: user.id }),
      studied({ goalId: goal.id, localDate: MONDAY, seconds: 60, userId: user.id }),
    ]);

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: sunday,
      startedAt: new Date("2026-10-11T23:50:00Z"),
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        completedAt: new Date("2026-10-11T23:59:00Z"),
        estimatedMinutes: 30,
        kind: "review",
        position: 0,
        sessionId: session.id,
        status: "completed",
      }),
      studySessionBlockFixture({
        kind: "practice",
        position: 1,
        sessionId: session.id,
        startedAt: new Date("2026-10-12T00:05:00Z"),
        status: "active",
      }),
    ]);

    mockSession(user.id);

    const [planView, today, historical] = await Promise.all([
      getPlanTabView(),
      getTodayView({ goalId: goal.id }),
      getStudySession({ input: {}, sessionId: session.id }),
    ]);

    expect(planView).toMatchObject({
      status: "ready",
      view: { plan: { weekTime: { studiedMinutes: 1, targetMinutes: 315 } } },
    });

    expect(today).toMatchObject({
      status: "ready",
      today: {
        session: { current: true, id: session.id, localDate: sunday, minutes: { done: 30 } },
      },
    });

    if (today.status !== "ready" || historical.status !== "ready") {
      throw new Error(`Expected ready views, received ${today.status} and ${historical.status}`);
    }

    expect(historical.session.week.days.at(-1)).toMatchObject({ date: sunday, minutes: 60 });

    expect(today.today.session.week.days[0]).toMatchObject({
      date: MONDAY,
      isToday: true,
      minutes: 1,
    });
  });

  it("names the next study day past the week's rest days, for when today's study time is used up", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T14:00:00Z"));
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });

    await Promise.all([
      prisma.goal.update({
        data: { createdAt: MONDAY, dailyMinutes: 45, timezone: "UTC" },
        where: { id: goal.id },
      }),
      prisma.plan.update({
        data: { settings: { weekdayMinutes: [0, 45, 45, 45, 45, 45, 0] } },
        where: { goalId: goal.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await studySessionFixture({ goalId: goal.id, localDate: FRIDAY, userId: user.id });
    mockSession(user.id);

    const today = await getTodayView({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error(`Expected ready Today, received ${today.status}`);
    }

    expect(today.today.session.week.days.slice(5).map((day) => day.kind)).toStrictEqual([
      "rest",
      "rest",
    ]);

    expect(today.today.session.week.nextStudyDate).toStrictEqual(new Date("2026-10-19T00:00:00Z"));
  });

  it("shows a day studied for under a minute as a minute, so it never reads studied with 0 min", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T14:00:00Z"));
    const user = await userFixture();
    const { goal } = await learnerGoalFixture({ phases: [1], userId: user.id });

    await Promise.all([
      prisma.goal.update({
        data: { createdAt: MONDAY, dailyMinutes: 30, timezone: "UTC" },
        where: { id: goal.id },
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studied({ goalId: goal.id, localDate: FRIDAY, seconds: 40, userId: user.id }),
    ]);

    mockSession(user.id);

    const today = await getTodayView({ goalId: goal.id });

    if (today.status !== "ready") {
      throw new Error(`Expected ready Today, received ${today.status}`);
    }

    expect(today.today.session.week.days[4]).toMatchObject({
      date: FRIDAY,
      minutes: 1,
      studied: true,
    });
  });

  it("counts a free exam goal's days past the free week at what its sessions hold", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
    const user = await userFixture();

    const { goal, planItems, skills } = await sessionGoalFixture({
      challengesDone: true,
      goal: { createdAt: daysAgo(10), kind: "exam" },
      userId: user.id,
    });

    await Promise.all([
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      dueSkillFixture({ skillId: skills[0]?.id ?? "", userId: user.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      studySessionFixture({
        endedAt: daysAgo(2),
        goalId: goal.id,
        localDate: new Date(SESSION_TODAY.getTime() - 2 * 86_400_000),
        plannedMinutes: 4,
        userId: user.id,
      }),
      studySessionFixture({
        endedAt: daysAgo(1),
        goalId: goal.id,
        localDate: new Date(SESSION_TODAY.getTime() - 86_400_000),
        plannedMinutes: 0,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);

    const [today, planView] = await Promise.all([
      getTodayView({ goalId: goal.id }),
      getPlanTabView({ goalId: goal.id }),
    ]);

    if (today.status !== "ready") {
      throw new Error("Expected Today to be ready");
    }

    const todayMinutes = today.today.session.minutes.planned;

    expect(todayMinutes).toBeGreaterThan(0);
    expect(todayMinutes).toBeLessThan(45);

    expect(
      today.today.session.week.days.map(({ goalMinutes, kind }) => ({ goalMinutes, kind })),
    ).toStrictEqual([
      { goalMinutes: 4, kind: "study" },
      { goalMinutes: 0, kind: "study" },
      { goalMinutes: todayMinutes, kind: "study" },
      { goalMinutes: 0, kind: "study" },
      { goalMinutes: 0, kind: "study" },
      { goalMinutes: 0, kind: "study" },
      { goalMinutes: 0, kind: "study" },
    ]);

    expect(planView).toMatchObject({
      status: "ready",
      view: { plan: { weekTime: { targetMinutes: 4 + todayMinutes } } },
    });
  });
});
