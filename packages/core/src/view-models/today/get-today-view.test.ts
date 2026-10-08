import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, suggestedGoalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryInsightFixture } from "@zoonk/testing/fixtures/memory";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { dismissGuardianInvite } from "../../minors/guardian/dismiss-guardian-invite";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  daysAgo,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { getTodayView } from "./get-today-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

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

describe(getTodayView, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers a teen who just signed up from a guest session to invite a guardian, until one is", async () => {
    const { goal, user } = await setup();
    const signedUpAt = new Date(SESSION_NOW.getTime() - 60 * 60 * 1000);

    // The goal came from the guest session: it's older than the account.
    await Promise.all([
      prisma.user.update({ data: { createdAt: signedUpAt }, where: { id: user.id } }),
      prisma.goal.update({
        data: { createdAt: new Date(signedUpAt.getTime() - DAY_MS) },
        where: { id: goal.id },
      }),
      prisma.userLearningProfile.update({
        data: { birthMonth: 3, birthYear: 2009 },
        where: { userId: user.id },
      }),
    ]);

    const before = await getTodayView({});
    expect(before.status === "ready" && before.today.guardianInvite).toBe(true);

    await prisma.guardianLink.create({
      data: {
        guardianEmail: "mom@zoonk.test",
        status: "pending",
        tokenHash: crypto.randomUUID(),
        userId: user.id,
      },
    });

    const after = await getTodayView({});
    expect(after.status === "ready" && after.today.guardianInvite).toBe(false);
  });

  it("stops offering the guardian invite once the teen says not now", async () => {
    const { goal, user } = await setup();
    const signedUpAt = new Date(SESSION_NOW.getTime() - 60 * 60 * 1000);

    await Promise.all([
      prisma.user.update({ data: { createdAt: signedUpAt }, where: { id: user.id } }),
      prisma.goal.update({
        data: { createdAt: new Date(signedUpAt.getTime() - DAY_MS) },
        where: { id: goal.id },
      }),
      prisma.userLearningProfile.update({
        data: { birthMonth: 3, birthYear: 2009 },
        where: { userId: user.id },
      }),
    ]);

    const before = await getTodayView({});
    expect(before.status === "ready" && before.today.guardianInvite).toBe(true);

    await expect(dismissGuardianInvite()).resolves.toStrictEqual({ status: "dismissed" });

    const after = await getTodayView({});
    expect(after.status === "ready" && after.today.guardianInvite).toBe(false);
  });

  it("leaves the invite to onboarding for a teen who signed up first, and never asks an adult", async () => {
    const { user } = await setup();

    const adult = await getTodayView({});
    expect(adult.status === "ready" && adult.today.guardianInvite).toBe(false);

    // Onboarding offered it after the age question: the goal is newer than the account.
    await prisma.userLearningProfile.update({
      data: { birthMonth: 3, birthYear: 2009 },
      where: { userId: user.id },
    });

    const teen = await getTodayView({});
    expect(teen.status === "ready" && teen.today.guardianInvite).toBe(false);
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
      suggestedGoal: { id: newest.id, status: "pending", title: "Physics" },
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
    expect(today.progress?.status).not.toBeNull();
    expect(today.studiedToday).toBe(false);

    expect(today.weeklyChallenge).toMatchObject({
      date: new Date(SESSION_TODAY.getTime() + 4 * DAY_MS),
      kind: "mock",
      planItemId: mock.id,
      title: "Test mock",
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

  it("opens the same session on a second visit the same day", async () => {
    await setup();
    const first = await getTodayView({});
    const second = await getTodayView({});

    if (first.status !== "ready" || second.status !== "ready") {
      throw new Error("Expected Today twice");
    }

    expect(second.today.session.id).toBe(first.today.session.id);

    await expect(
      prisma.studySession.count({ where: { id: first.today.session.id } }),
    ).resolves.toBe(1);
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
