import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "./_test-utils/open-today";
import { DAY_MS, SESSION_NOW, daysAgo, sessionGoalFixture } from "./_test-utils/session-goal";
import { addExtraStudyBlock } from "./add-extra-study-block";

async function lessonsDoneLearner(
  dailyMinutes: number,
  { dailyLimitMinutes = null }: { dailyLimitMinutes?: number | null } = {},
) {
  const user = await userFixture();

  const { goal, plan, skills } = await sessionGoalFixture({
    goal: { dailyMinutes },
    itemsPerSkill: 30,
    lessons: 6,
    userId: user.id,
  });

  await Promise.all([
    prisma.planItem.updateMany({
      data: { completedAt: daysAgo(3), status: "done" },
      where: { planId: plan.id },
    }),
    learningProfileFixture({ activeGoalId: goal.id, dailyLimitMinutes, userId: user.id }),
    ...skills.map((skill) =>
      learnerSkillFixture({
        difficulty: 5,
        due: new Date(SESSION_NOW.getTime() + 5 * DAY_MS),
        lastReviewedAt: daysAgo(3),
        reps: 2,
        skillId: skill.id,
        stability: 10,
        state: "learning",
        userId: user.id,
      }),
    ),
  ]);

  return { goal, user };
}

async function openPractice(...input: Parameters<typeof lessonsDoneLearner>) {
  const { goal, user } = await lessonsDoneLearner(...input);

  mockSession(user.id);
  const today = await getTodayStudySession({ goalId: goal.id });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  const practice = today.session.blocks.filter((block) => block.kind === "practice");

  return {
    blocks: practice,
    minutes: practice.reduce((sum, block) => sum + block.estimatedMinutes, 0),
    plannedMinutes: today.session.minutes.planned,
    sessionId: today.session.id,
  };
}

describe("practice once the plan's lessons are done", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("grows with the learner's chosen time instead of stopping at a fixed number of questions", async () => {
    const hour = await openPractice(60);
    const twoHours = await openPractice(120);

    expect(hour.plannedMinutes).toBeGreaterThan(55);
    expect(twoHours.plannedMinutes).toBeGreaterThan(115);
    expect(twoHours.plannedMinutes).toBeLessThanOrEqual(120);
    expect(twoHours.minutes).toBeGreaterThan(hour.minutes + 50);
  });

  it("splits a long day's practice into short blocks", async () => {
    const { blocks } = await openPractice(120);

    expect(blocks.length).toBeGreaterThan(4);
    expect(blocks.every((block) => block.estimatedMinutes <= 15)).toBe(true);
    expect(blocks.every((block) => block.topics.length > 0)).toBe(true);
    expect(new Set(blocks.map((block) => block.topics[0])).size).toBeGreaterThan(1);
  });

  it("fills a long day only up to the learner's daily limit", async () => {
    const { minutes, plannedMinutes } = await openPractice(120, { dailyLimitMinutes: 40 });

    expect(minutes).toBeGreaterThan(20);
    expect(plannedMinutes).toBeLessThanOrEqual(40);
  });

  it("keeps adding bonus practice past two blocks once the day is done", async () => {
    const { sessionId } = await openPractice(20);

    const finishAll = () =>
      prisma.studySessionBlock.updateMany({ data: { status: "completed" }, where: { sessionId } });

    await finishAll();
    await addExtraStudyBlock({ sessionId });
    await finishAll();
    await addExtraStudyBlock({ sessionId });
    await finishAll();

    await expect(addExtraStudyBlock({ sessionId })).resolves.toMatchObject({
      block: {
        estimatedMinutes: 9,
        extra: true,
        kind: "practice",
        questions: 6,
        topics: expect.arrayContaining([expect.stringMatching(/^Skill \d$/u)]),
      },
      status: "ready",
    });
  });
});
