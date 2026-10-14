import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, suggestedGoalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  daysAgo,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getTodayView } from "./get-today-view";

const DAYS_TO_EXAM = 32;

/** A learner whose active goal is an exam 32 days away, with a weekly mock in the plan. */
async function setup() {
  const user = await userFixture();

  const fixture = await sessionGoalFixture({
    goal: {
      kind: "exam",
      targetDate: new Date(SESSION_TODAY.getTime() + DAYS_TO_EXAM * DAY_MS),
      title: "ENEM 2026",
    },
    userId: user.id,
  });

  const [mock] = await Promise.all([
    checkpointItemFixture({
      kind: "mock",
      planId: fixture.plan.id,
      position: fixture.planItems.length,
      scheduledFor: new Date(SESSION_TODAY.getTime() + 4 * DAY_MS),
    }),
    learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id }),
  ]);

  mockSession(user.id);
  return { ...fixture, mock, user };
}

/** Today for the signed-in learner's active goal, when it's ready. */
async function readReadyToday() {
  const result = await getTodayView({});
  return result.status === "ready" ? result.today : null;
}

describe(getTodayView, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses a visitor without a session", async () => {
    mockSession(null);
    await expect(getTodayView({})).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("asks a learner without a goal to start one", async () => {
    const user = await userFixture();
    mockSession(user.id);

    await expect(getTodayView({})).resolves.toStrictEqual({
      status: "noGoal",
      suggestedGoal: null,
    });
  });

  it("offers a learner without a goal their most recent course still waiting for an answer", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const [newest] = await Promise.all([
      suggestedGoalFixture({ lastActiveAt: daysAgo(1), title: "Physics", userId: user.id }),
      suggestedGoalFixture({ lastActiveAt: daysAgo(5), title: "Chemistry", userId: user.id }),
      suggestedGoalFixture({
        lastActiveAt: SESSION_NOW,
        status: "dismissed",
        title: "Biology",
        userId: user.id,
      }),
    ]);

    await expect(getTodayView({})).resolves.toStrictEqual({
      status: "noGoal",
      suggestedGoal: { courseId: null, id: newest.id, status: "pending", title: "Physics" },
    });
  });

  it("shows the active goal's countdown, status and today's session", async () => {
    const { goal, lessons, mock } = await setup();
    const result = await getTodayView({});

    if (result.status !== "ready") {
      throw new Error(`Expected Today, got ${result.status}`);
    }

    const { today } = result;

    expect(today.goal).toStrictEqual({
      dateEstimated: false,
      daysLeft: DAYS_TO_EXAM,
      id: goal.id,
      kind: "exam",
      targetDate: goal.targetDate,
      title: "ENEM 2026",
    });

    expect(today.session.goalId).toBe(goal.id);
    expect(Object.values(today.lessonStatus)).toContain("notStarted");
    expect(today.session.blocks.map((block) => block.lessonId)).toContain(lessons[0]?.id);

    expect(today.progress).toMatchObject({
      measure: "preparation",
      status: { kind: "onTrack" },
      weekGain: 0,
    });

    expect(today.studiedToday).toBe(false);

    expect(today.weeklyChallenge).toMatchObject({
      date: new Date(SESSION_TODAY.getTime() + 4 * DAY_MS),
      kind: "mock",
      planItemId: mock.id,
      title: "Test mock",
    });
  });

  // Lucas's Today said "The day is here" every day after his date, beside a rest day.
  it("counts no days once the goal's date passed, and says it came with lessons left", async () => {
    const user = await userFixture();

    const fixture = await sessionGoalFixture({
      goal: { targetDate: new Date(SESSION_TODAY.getTime() - 2 * DAY_MS) },
      userId: user.id,
    });

    await Promise.all([
      learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id }),
      prisma.planItem.updateMany({
        data: { scheduledFor: new Date(SESSION_TODAY.getTime() - 3 * DAY_MS) },
        where: { planId: fixture.plan.id },
      }),
    ]);

    mockSession(user.id);

    const result = await getTodayView({});
    const today = result.status === "ready" ? result.today : null;

    expect(today?.goal.daysLeft).toBeNull();
    expect(today?.progress?.status).toMatchObject({ kind: "pastDate" });
  });

  // Pedro's Plan read "Progress 4%" after he finished every lesson: a goal without an exam reads
  // its progress as the Plan's lessons, not as preparation.
  it("measures a goal that isn't an exam by its plan's lessons studied or known", async () => {
    const user = await userFixture();
    const fixture = await sessionGoalFixture({ goal: { kind: "learn" }, userId: user.id });

    await Promise.all([
      learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id }),
      prisma.plan.update({
        data: {
          graph: {
            phases: [{ name: "Basics" }],
            skills: fixture.skills.map((skill) => ({
              lessons: 1,
              name: skill.name,
              phase: 0,
              skillId: skill.id,
            })),
          },
        },
        where: { id: fixture.plan.id },
      }),
      prisma.planItem.update({
        data: { completedAt: daysAgo(1), status: "done" },
        where: { id: fixture.planItems[0]?.id ?? "" },
      }),
    ]);

    mockSession(user.id);

    const result = await getTodayView({});
    const progress = result.status === "ready" ? result.today.progress : null;

    expect(progress).toMatchObject({
      lessons: { done: 1, total: 3 },
      measure: "lessons",
      value: 1 / 3,
    });
  });

  // Today's card outlined a lesson as still to do after the learner finished it through another
  // goal sharing it: today's lessons are the session's plan lessons still to do, each once.
  it("counts today's plan lessons still to do, each once", async () => {
    const user = await userFixture();
    const fixture = await sessionGoalFixture({ goal: { kind: "learn" }, userId: user.id });

    await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
    mockSession(user.id);

    const today = await readReadyToday();

    const lessonBlocks =
      today?.session.blocks.filter((block) => block.kind === "learn" && block.planItemId) ?? [];

    const planItemIds = [...new Set(lessonBlocks.map((block) => block.planItemId))];
    const [first] = lessonBlocks;

    expect(planItemIds.length).toBeGreaterThan(0);
    expect(today?.progress).toMatchObject({ lessons: { today: planItemIds.length } });

    // A bonus copy of one of them is the same lesson.
    const copied = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: first?.id } });

    await prisma.studySessionBlock.create({
      data: {
        kind: copied.kind,
        lessonId: copied.lessonId,
        payload: copied.payload ?? {},
        position: 99,
        sessionId: copied.sessionId,
      },
    });

    const withCopy = await readReadyToday();
    expect(withCopy?.progress).toMatchObject({ lessons: { today: planItemIds.length } });

    // Finished elsewhere, its plan item is done, so it no longer counts.
    await prisma.planItem.update({
      data: { completedAt: new Date(), status: "done" },
      where: { id: first?.planItemId ?? "" },
    });

    const finishedElsewhere = await readReadyToday();

    expect(finishedElsewhere?.progress).toMatchObject({
      lessons: { today: planItemIds.length - 1 },
    });
  });

  it("says the learner studied today once today has study time, on any goal", async () => {
    const { user } = await setup();

    await dailyProgressFixtureMany([
      { date: daysAgo(1), timeSpentSeconds: 900, userId: user.id },
      { date: SESSION_TODAY, timeSpentSeconds: 300, userId: user.id },
    ]);

    const result = await getTodayView({});

    expect(result.status === "ready" && result.today.studiedToday).toBe(true);
  });

  it("carries the insight waiting for this goal", async () => {
    const { goal, user } = await setup();

    // Insights come from memory, which a learner without an age answer turns on themselves.
    await learningProfileFixture({ memoryEnabled: true, userId: user.id });

    const insight = await memoryInsightFixture({
      createdAt: SESSION_NOW,
      goalId: goal.id,
      userId: user.id,
    });

    const result = await getTodayView({});

    expect(result.status === "ready" && result.today.insight).toMatchObject({
      id: insight.id,
      kind: "tip",
      message: insight.message,
    });
  });

  it("carries a suggested goal below the active goal's day", async () => {
    const { user } = await setup();
    const suggestion = await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const result = await getTodayView({});

    expect(result.status === "ready" && result.today.suggestedGoal).toStrictEqual({
      courseId: null,
      id: suggestion.id,
      status: "pending",
      title: "Spanish",
    });
  });

  it("opens the first active goal when none was picked yet", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: user.id });
    mockSession(user.id);

    const result = await getTodayView({});

    expect(result.status === "ready" && result.today.goal.id).toBe(goal.id);
  });

  it("reads another goal's Today when asked", async () => {
    const { user } = await setup();
    const other = await sessionGoalFixture({ goal: { title: "Other goal" }, userId: user.id });
    const result = await getTodayView({ goalId: other.goal.id });

    expect(result.status === "ready" && result.today.goal).toMatchObject({
      daysLeft: null,
      id: other.goal.id,
      title: "Other goal",
    });
  });

  it("waits for a plan that is still being built instead of fixing an empty day", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ title: "Quantum physics", userId: user.id });

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(getTodayView({})).resolves.toStrictEqual({
      goal: { id: goal.id, kind: "learn", title: "Quantum physics" },
      status: "preparing",
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it("has no day to plan for a paused goal", async () => {
    const { goal } = await setup();
    await prisma.goal.update({ data: { status: "paused" }, where: { id: goal.id } });

    await expect(getTodayView({})).resolves.toStrictEqual({ status: "goalNotActive" });
  });

  it("has no day to plan for a learner with only quick explanations", async () => {
    const user = await userFixture();

    const { goal } = await sessionGoalFixture({
      goal: { kind: "explain", title: "How a microwave works" },
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    await expect(getTodayView({})).resolves.toStrictEqual({
      status: "noGoal",
      suggestedGoal: null,
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
  });

  it("keeps a quick explanation's day for a learner who also has a plan to study", async () => {
    const { user } = await setup();

    const explanation = await sessionGoalFixture({
      goal: { kind: "explain", title: "How a microwave works" },
      userId: user.id,
    });

    const result = await getTodayView({ goalId: explanation.goal.id });

    expect(result.status === "ready" && result.today.goal.id).toBe(explanation.goal.id);
  });

  it("never shows another learner's goal", async () => {
    const { goal } = await setup();
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(getTodayView({ goalId: goal.id })).resolves.toStrictEqual({ status: "notFound" });
  });
});
