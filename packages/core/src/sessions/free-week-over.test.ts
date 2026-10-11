import { prisma } from "@zoonk/db";
import { planChangeFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { lessonRunFixture } from "../lesson-player/_test-utils/lesson-run-fixture";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { requestLessonGeneration } from "../lookahead/request-lesson-generation";
import { getGoalPlan } from "../plans/get-goal-plan";
import { getGoalPreparation } from "../preparation/get-goal-preparation";
import { getTodayStudySession } from "./_test-utils/open-today";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { addExtraStudyBlock } from "./add-extra-study-block";
import { catchUpToday } from "./catch-up-today";
import { getStudySessionSummary } from "./get-study-session-summary";

const TIME_ZONE = "UTC";

/**
 * An exam goal started ten days ago, so a free plan's first week is over: its first lesson is done
 * and due for review, its next two are what missed days left to catch up, and four written lessons
 * follow: one still to do, one done and one begun during the free week, then a phase challenge.
 * The learner studied yesterday, so today isn't a fresh start after a break.
 */
async function examPastFreeWeek({ plus = false }: { plus?: boolean } = {}) {
  const user = await userFixture();

  const fixture = await sessionGoalFixture({
    goal: { createdAt: daysAgo(10), kind: "exam" },
    userId: user.id,
  });

  const [first, ...missed] = fixture.planItems;

  const [next, done, begun] = await Promise.all([
    playableLessonFixture(),
    playableLessonFixture(),
    playableLessonFixture(),
  ]);

  const planned = [next, done, begun].map((created, index) =>
    planItemFixture({
      kind: "lesson",
      lessonId: created.lesson.id,
      planId: fixture.plan.id,
      position: 3 + index,
      status: created === done ? "done" : "todo",
      titleSnapshot: created.lesson.title,
    }),
  );

  await Promise.all([
    ...planned,
    prisma.planItem.update({
      data: { completedAt: daysAgo(9), status: "done" },
      where: { id: first?.id },
    }),
    dueSkillFixture({ skillId: fixture.skills[0]?.id ?? "", userId: user.id }),
    learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id }),
    planChangeFixture({
      kind: "missedDays",
      payload: { carriedItemIds: missed.map((item) => item.id) },
      planId: fixture.plan.id,
    }),
    lessonRunFixture({ lessonId: begun.lesson.id, startedAt: daysAgo(8), userId: user.id }),
    // Studied yesterday, so today is an ordinary day, not a return that leaves catching up out.
    dailyProgressFixtureMany([{ date: daysAgo(1), timeSpentSeconds: 1200, userId: user.id }]),
    plus &&
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
  ]);

  const boss = await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 6 });

  mockSession(user.id);

  return {
    ...fixture,
    begun: begun.lesson,
    boss,
    done: done.lesson,
    next: next.lesson,
    unwritten: fixture.lessons[1],
    user,
  };
}

/** Lays the plan's items out on today, so the plan has a pace to read. */
function scheduleToday(planId: string) {
  return prisma.planItem.updateMany({ data: { scheduledFor: SESSION_TODAY }, where: { planId } });
}

async function openToday(goalId: string) {
  const result = await getTodayStudySession({ goalId, timeZone: TIME_ZONE });

  if (result.status !== "ready") {
    throw new Error(`Expected today's session, got ${result.status}`);
  }

  return result.session;
}

function start(lessonId: string) {
  return startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId });
}

describe("a free exam plan past its first week", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // rafa3: Today said Plus opens new lessons, yet "Catch up today" added 205 of them to the day.
  it("offers no catch-up, and refuses one asked for, while Plus keeps it", async () => {
    const free = await examPastFreeWeek();
    const day = await openToday(free.goal.id);

    expect(day.examAccess.trialEnded).toBe(true);
    expect(day.catchUp).toBeNull();
    expect(day.blocks.some((block) => block.kind === "learn")).toBe(false);

    await expect(
      catchUpToday({ input: { timeZone: TIME_ZONE }, sessionId: day.id }),
    ).resolves.toStrictEqual({ status: "plusRequired" });

    await expect(
      prisma.studySessionBlock.count({ where: { kind: "learn", sessionId: day.id } }),
    ).resolves.toBe(0);

    const plus = await examPastFreeWeek({ plus: true });
    const plusDay = await openToday(plus.goal.id);

    expect(plusDay.catchUp?.lessonsLeft).toBe(2);
  });

  it("opens the plan's new lessons with Plus only, and keeps the rest open", async () => {
    const { begun, done, next } = await examPastFreeWeek();

    await expect(start(next.id)).resolves.toStrictEqual({ status: "plusRequired" });

    // Refused before the allowance: nothing was counted or opened.
    await expect(
      prisma.learningEvent.count({
        where: { contentIds: { equals: next.id, path: ["lessonId"] } },
      }),
    ).resolves.toBe(0);

    // A lesson done (a replay), one begun during the free week and one outside the plan.
    const outside = await playableLessonFixture();

    await expect(start(done.id)).resolves.toMatchObject({ status: "started" });
    await expect(start(begun.id)).resolves.toMatchObject({ status: "started" });
    await expect(start(outside.lesson.id)).resolves.toMatchObject({ status: "started" });

    const plus = await examPastFreeWeek({ plus: true });

    await expect(start(plus.next.id)).resolves.toMatchObject({ status: "started" });
  });

  it("never writes a lesson the plan holds for Plus", async () => {
    const { unwritten, user } = await examPastFreeWeek();

    await expect(requestLessonGeneration({ lessonId: unwritten?.id ?? "" })).resolves.toStrictEqual(
      { status: "plusRequired" },
    );

    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("offers no bonus practice or lessons after the day's reviews", async () => {
    const { goal } = await examPastFreeWeek();
    const day = await openToday(goal.id);

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), startedAt: new Date(), status: "completed" },
      where: { sessionId: day.id },
    });

    const done = await openToday(goal.id);

    expect(done.extraTime).toStrictEqual({ available: false, minutes: 0, reason: "plusRequired" });

    await expect(addExtraStudyBlock({ sessionId: day.id })).resolves.toStrictEqual({
      reason: "plusRequired",
      status: "unavailable",
    });
  });

  // The session's last screen said "Tomorrow: <next lesson>", a lesson the free plan no longer opens.
  it("ends the day without promising tomorrow's new lesson, while Plus keeps it", async () => {
    const free = await examPastFreeWeek();
    const day = await openToday(free.goal.id);
    const summary = await getStudySessionSummary({ input: {}, sessionId: day.id });

    expect(summary).toMatchObject({ status: "ready", summary: { tomorrow: null } });

    const plus = await examPastFreeWeek({ plus: true });
    const plusDay = await openToday(plus.goal.id);
    const plusSummary = await getStudySessionSummary({ input: {}, sessionId: plusDay.id });

    expect(plusSummary).toMatchObject({
      status: "ready",
      summary: { tomorrow: { title: expect.any(String) } },
    });
  });

  // Today's header said "199 lessons to catch up": lessons the free plan no longer opens. A plan
  // only Plus moves has no pace to keep, and the free-week notice says why.
  it("reads no pace against the plan, while Plus keeps its lessons to catch up", async () => {
    const free = await examPastFreeWeek();
    await scheduleToday(free.plan.id);

    await expect(getGoalPreparation(free.goal.id)).resolves.toMatchObject({
      preparation: { status: null },
      status: "ready",
    });

    await expect(getGoalPlan(free.goal.id)).resolves.toMatchObject({
      plan: { status: null },
      status: "ready",
    });

    const plus = await examPastFreeWeek({ plus: true });
    await scheduleToday(plus.plan.id);
    const behind = { kind: "behind", lessons: 2 };

    await expect(getGoalPreparation(plus.goal.id)).resolves.toMatchObject({
      preparation: { status: behind },
    });

    await expect(getGoalPlan(plus.goal.id)).resolves.toMatchObject({ plan: { status: behind } });
  });

  it("holds a phase challenge for Plus, as the day's session does", async () => {
    const { boss } = await examPastFreeWeek();

    await expect(getChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      challenge: { status: "plusRequired" },
      status: "ready",
    });

    await expect(startChallenge({ input: {}, planItemId: boss.id })).resolves.toStrictEqual({
      status: "plusRequired",
    });
  });
});
