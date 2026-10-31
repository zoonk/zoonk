import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { toIsoDate } from "../plans/planner/plan-calendar";
import { getTodayStudySession } from "./_test-utils/open-today";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";

async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ userId: user.id });
  const [firstSkill] = fixture.skills;
  const [firstItem] = fixture.items;

  await Promise.all([
    prisma.planItem.update({
      data: { completedAt: daysAgo(3), status: "done" },
      where: { id: fixture.planItems[0]?.id },
    }),
    dueSkillFixture({ skillId: firstSkill?.id ?? "", userId: user.id }),
    mistakeFixture({
      createdAt: daysAgo(1),
      itemId: firstItem?.id,
      skillId: firstSkill?.id,
      userId: user.id,
    }),
    learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id }),
    dailyProgressFixtureMany([{ date: daysAgo(1), timeSpentSeconds: 1200, userId: user.id }]),
  ]);

  mockSession(user.id);
  return { ...fixture, user };
}

async function examReviewTitles(examInDays: number) {
  const user = await userFixture();

  const targetDate = new Date(SESSION_TODAY.getTime() + examInDays * DAY_MS);

  const { goal, plan, skills } = await sessionGoalFixture({
    goal: { createdAt: daysAgo(1), kind: "exam", targetDate },
    userId: user.id,
  });

  const finalStretch = {
    endDate: toIsoDate(new Date(targetDate.getTime() - DAY_MS)),
    kind: "finalStretch",
    startDate: toIsoDate(new Date(targetDate.getTime() - 14 * DAY_MS)),
  };

  await Promise.all([
    prisma.plan.update({ data: { phases: [finalStretch] }, where: { id: plan.id } }),
    dueSkillFixture({ due: daysAgo(-3), skillId: skills[0]?.id ?? "", userId: user.id }),
    dueSkillFixture({ due: daysAgo(-20), skillId: skills[1]?.id ?? "", userId: user.id }),
  ]);

  await layOutPlanFixture(plan.id);
  mockSession(user.id);
  const result = await getTodayStudySession({ goalId: goal.id });

  if (result.status !== "ready") {
    throw new Error(`Expected a session, got ${result.status}`);
  }

  const review = result.session.blocks.find((block) => block.kind === "review");
  return review?.capsules.map((capsule) => capsule.title) ?? [];
}

describe(getTodayStudySession, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds today's session in the session shape for the active goal", async () => {
    const { lessons, user } = await setup();
    const result = await getTodayStudySession({});

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const { session } = result;

    expect(session.localDate).toStrictEqual(SESSION_TODAY);
    expect(session.freshStart).toBeNull();

    expect(session.blocks.map((block) => [block.kind, block.lessonId])).toStrictEqual([
      ["review", null],
      ["learn", lessons[1]?.id],
      ["learn", lessons[2]?.id],
      ["practice", null],
    ]);

    expect(session.blocks[0]?.capsules).toMatchObject([
      { format: "rapidFire", lessonId: lessons[0]?.id, opened: false, title: "Lesson 1" },
    ]);

    expect(session.blocks[1]).toMatchObject({ canDo: "You'll do thing 2", status: "pending" });
    expect(session.blocks[3]?.questions).toBeGreaterThan(0);
    expect(session.nextBlockId).toBe(session.blocks[0]?.id);

    expect(session.missions.map((mission) => [mission.kind, mission.status])).toStrictEqual([
      ["review", "todo"],
      ["somethingNew", "todo"],
    ]);

    expect(session.minutes).toStrictEqual({
      dailyGoal: 45,
      done: 0,
      planned: session.minutes.planned,
    });

    expect(session.week.days.find((day) => day.isToday)?.date).toStrictEqual(SESSION_TODAY);
    expect(session.week.days.filter((day) => day.studied)).toHaveLength(1);

    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("returns the same session all day, even when opened twice at once", async () => {
    const { user } = await setup();

    const results = await Promise.all([
      getTodayStudySession({}),
      getTodayStudySession({}),
      getTodayStudySession({}),
    ]);

    const ids = results.map((result) => (result.status === "ready" ? result.session.id : null));

    expect(new Set(ids).size).toBe(1);
    await expect(prisma.studySession.count({ where: { userId: user.id } })).resolves.toBe(1);

    const again = await getTodayStudySession({});
    expect(again.status === "ready" && again.session.id).toBe(ids[0]);

    const blocks = await prisma.studySessionBlock.count({ where: { sessionId: ids[0] ?? "" } });
    expect(again.status === "ready" && again.session.blocks).toHaveLength(blocks);
  });

  it("makes the first session after a break lighter and says so", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { createdAt: daysAgo(7) },
      lessons: 8,
      userId: user.id,
    });

    await Promise.all([
      dailyProgressFixtureMany([{ date: daysAgo(7), timeSpentSeconds: 900, userId: user.id }]),
      studySessionFixture({ goalId: goal.id, localDate: daysAgo(7), userId: user.id }),
      layOutPlanFixture(plan.id),
    ]);

    mockSession(user.id);

    const result = await getTodayStudySession({ goalId: goal.id });

    expect(result.status === "ready" && result.session.freshStart).toBe("welcomeBack");
    expect(result.status === "ready" && result.session.minutes.planned).toBeLessThanOrEqual(20);
    expect(result.status === "ready" ? result.session.missions.length : 0).toBeGreaterThan(0);

    const again = await getTodayStudySession({ goalId: goal.id });

    expect(again.status === "ready" && again.session.missions).toStrictEqual(
      result.status === "ready" && result.session.missions,
    );
  });

  it("starts nothing over on a goal's first day, even for a learner back from a break", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ lessons: 8, userId: user.id });

    await dailyProgressFixtureMany([{ date: daysAgo(5), timeSpentSeconds: 900, userId: user.id }]);
    mockSession(user.id);

    const result = await getTodayStudySession({ goalId: goal.id });

    expect(result.status === "ready" && result.session.freshStart).toBeNull();
    expect(result.status === "ready" && result.session.blocks.length > 0).toBe(true);
  });

  it("follows the plan's week: a rest day has nothing to do and a light week is shorter", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { createdAt: daysAgo(7) },
      lessons: 8,
      userId: user.id,
    });

    await Promise.all([
      prisma.plan.update({
        data: { settings: { weekdayMinutes: [45, 45, 45, 0, 45, 45, 45] } },
        where: { id: plan.id },
      }),
      layOutPlanFixture(plan.id),
    ]);

    mockSession(user.id);
    const rest = await getTodayStudySession({ goalId: goal.id });

    expect(rest.status === "ready" && rest.session.blocks).toStrictEqual([]);
    expect(rest.status === "ready" && rest.session.minutes.dailyGoal).toBe(0);

    expect(
      rest.status === "ready" && rest.session.week.days.filter((day) => day.goalMinutes > 0),
    ).toHaveLength(6);

    const other = await sessionGoalFixture({ lessons: 8, userId: user.id });

    await prisma.plan.update({
      data: { settings: { lightWeeks: [{ endDate: "2026-10-04", startDate: "2026-09-28" }] } },
      where: { id: other.plan.id },
    });

    const light = await getTodayStudySession({ goalId: other.goal.id });

    expect(light.status === "ready" && light.session.minutes.dailyGoal).toBe(23);
    expect(light.status === "ready" && light.session.minutes.planned).toBeLessThanOrEqual(23);
  });

  it("gives day one a session even when the learner rests on its weekday", async () => {
    const user = await userFixture();

    const { goal, plan } = await sessionGoalFixture({
      goal: { createdAt: SESSION_NOW },
      lessons: 8,
      userId: user.id,
    });

    await prisma.plan.update({
      data: {
        settings: {
          startDate: toIsoDate(SESSION_TODAY),
          weekdayMinutes: [45, 45, 45, 0, 45, 45, 45],
        },
      },
      where: { id: plan.id },
    });

    mockSession(user.id);
    const result = await getTodayStudySession({ goalId: goal.id });

    expect(result.status === "ready" && result.session.minutes.dailyGoal).toBe(45);
    expect(result.status === "ready" && result.session.blocks.length > 0).toBe(true);
  });

  it("counts only the days since the goal started in its first week", async () => {
    const user = await userFixture();

    const { goal } = await sessionGoalFixture({
      goal: { createdAt: SESSION_NOW },
      userId: user.id,
    });

    mockSession(user.id);
    const result = await getTodayStudySession({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const { days } = result.session.week;

    expect(days.filter((day) => day.goalMinutes > 0)).toHaveLength(5);

    expect(days.slice(0, 2).map((day) => [day.goalMinutes, day.kind])).toStrictEqual([
      [0, "beforeStart"],
      [0, "beforeStart"],
    ]);

    expect(days.find((day) => day.isToday)).toMatchObject({ kind: "study" });
    expect(days.find((day) => day.isToday)?.goalMinutes).toBeGreaterThan(0);
  });

  it("measures a day already past against what it asked, after the learner's time changes", async () => {
    const user = await userFixture();

    const { goal } = await sessionGoalFixture({ goal: { createdAt: daysAgo(7) }, userId: user.id });

    await Promise.all([
      studySessionFixture({
        goalId: goal.id,
        localDate: daysAgo(2),
        plannedMinutes: 45,
        userId: user.id,
      }),
      dailyProgressFixtureMany([{ date: daysAgo(2), timeSpentSeconds: 2700, userId: user.id }]),
      prisma.goal.update({ data: { dailyMinutes: 180 }, where: { id: goal.id } }),
    ]);

    mockSession(user.id);
    const result = await getTodayStudySession({ goalId: goal.id });

    if (result.status !== "ready") {
      throw new Error(`Expected a session, got ${result.status}`);
    }

    const monday = result.session.week.days.find(
      (day) => day.date.getTime() === new Date(toIsoDate(daysAgo(2))).getTime(),
    );

    expect(monday).toMatchObject({ goalMinutes: 45, hitGoal: true, minutes: 45 });

    expect(result.session.week.days.find((day) => day.isToday)?.goalMinutes).toBe(180);
  });

  it("fits the learner's daily limit", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: user.id });

    await Promise.all([
      learningProfileFixture({ dailyLimitMinutes: 10, userId: user.id }),
      dailyProgressFixtureMany([
        { date: SESSION_TODAY, timeSpentSeconds: 9 * 60, userId: user.id },
      ]),
    ]);

    mockSession(user.id);
    const result = await getTodayStudySession({ goalId: goal.id });

    expect(result.status === "ready" && result.session.blocks).toStrictEqual([]);

    expect(result.status === "ready" && result.session.dailyLimit).toMatchObject({
      limitMinutes: 10,
      remainingMinutes: 1,
    });

    expect(result.status === "ready" && result.session.extraTime).toMatchObject({
      available: false,
      reason: "dailyLimit",
    });
  });

  it("keeps reviews and fixes free once a free exam plan's first week is over", async () => {
    const user = await userFixture();

    const { goal, items, planItems, skills } = await sessionGoalFixture({
      goal: { createdAt: daysAgo(10), kind: "exam" },
      userId: user.id,
    });

    await Promise.all([
      prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]?.id } }),
      dueSkillFixture({ skillId: skills[0]?.id ?? "", userId: user.id }),
      mistakeFixture({
        createdAt: daysAgo(2),
        itemId: items[0]?.id,
        skillId: skills[0]?.id,
        userId: user.id,
      }),
    ]);

    mockSession(user.id);
    const result = await getTodayStudySession({ goalId: goal.id });

    expect(result.status === "ready" && result.session.examAccess).toStrictEqual({
      includesMockExams: false,
      trialEnded: true,
    });

    expect(
      result.status === "ready" && result.session.blocks.map((block) => block.kind),
    ).toStrictEqual(["review", "practice"]);
  });

  it("reviews every skill that would fade before the exam once the final stretch starts", async () => {
    await expect(examReviewTitles(10)).resolves.toStrictEqual(["Lesson 1"]);
    await expect(examReviewTitles(40)).resolves.toStrictEqual([]);
  });
});
