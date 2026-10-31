import { type StudySessionBlock, prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { openStudyBlock } from "./open-block";
import { openStudyDay } from "./open-study-day";

const BOSS = {
  kind: "boss",
  mock: false,
  passMark: 0,
  phase: 0,
  rematch: false,
  timeLimitMinutes: null,
} as const;

function owedPreparations(sessionId: string) {
  return prisma.followUp.count({ where: { key: sessionId, kind: "prepareSession" } });
}

function readBlock(block: Pick<StudySessionBlock, "id">) {
  return prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
}

async function learnerSession() {
  const user = await userFixture();
  const session = await studySessionFixture({ userId: user.id });
  mockSession(user.id);
  return { session, user };
}

async function goalDaySession() {
  const user = await userFixture();
  const { goal, plan } = await sessionGoalFixture({ userId: user.id });
  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  mockSession(user.id);
  return { plan, session };
}

function tap(block: Pick<StudySessionBlock, "id">) {
  return openStudyBlock({ target: { blockId: block.id, kind: "block" }, timeZone: "UTC" });
}

function mission(block: Pick<StudySessionBlock, "id">) {
  return openStudyBlock({ target: { blockId: block.id, kind: "mission" }, timeZone: "UTC" });
}

describe("the learner opens a study block", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("starts a written lesson in the player and prepares what comes next", async () => {
    const [{ session }, lesson] = await Promise.all([
      learnerSession(),
      libraryLessonFixture({ contentStatus: "completed" }),
    ]);

    const block = await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });

    await expect(tap(block)).resolves.toStrictEqual({
      opening: { kind: "lesson", lessonId: lesson.id, sessionId: session.id },
      status: "ready",
    });

    await expect(readBlock(block)).resolves.toMatchObject({ status: "active" });
    await expect(owedPreparations(session.id)).resolves.toBe(1);
  });

  it("leaves an unwritten lesson to the learner's request, with nothing started or prepared", async () => {
    const [{ session }, lesson] = await Promise.all([
      learnerSession(),
      libraryLessonFixture({ contentStatus: "pending" }),
    ]);

    const block = await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });

    await expect(tap(block)).resolves.toStrictEqual({
      opening: {
        blockId: block.id,
        kind: "unwrittenLesson",
        lessonId: lesson.id,
        sessionId: session.id,
      },
      status: "ready",
    });

    await expect(readBlock(block)).resolves.toMatchObject({ status: "pending" });
    await expect(owedPreparations(session.id)).resolves.toBe(0);
  });

  it("prepares a step whose lesson the plan hasn't picked yet, without starting it", async () => {
    const { session } = await learnerSession();
    const block = await studySessionBlockFixture({ lessonId: null, sessionId: session.id });

    await expect(tap(block)).resolves.toStrictEqual({
      opening: { blockId: block.id, kind: "preparingLesson" },
      status: "ready",
    });

    await expect(readBlock(block)).resolves.toMatchObject({ status: "pending" });
    await expect(owedPreparations(session.id)).resolves.toBe(1);
  });

  it("starts review on the session screen and an essay on its own", async () => {
    const { session } = await learnerSession();

    const [review, essay] = await Promise.all([
      studySessionBlockFixture({ kind: "review", position: 0, sessionId: session.id }),
      studySessionBlockFixture({ kind: "produce", position: 1, sessionId: session.id }),
    ]);

    await expect(tap(review)).resolves.toStrictEqual({
      opening: { blockId: review.id, kind: "session" },
      status: "ready",
    });

    await expect(tap(essay)).resolves.toStrictEqual({
      opening: { blockId: essay.id, kind: "essay" },
      status: "ready",
    });

    await expect(readBlock(review)).resolves.toMatchObject({ startedAt: SESSION_NOW });
    await expect(readBlock(essay)).resolves.toMatchObject({ status: "active" });
  });

  it("opens the session for a finished step and Today once the day's time is used up", async () => {
    const { session, user } = await learnerSession();

    const [done, review] = await Promise.all([
      studySessionBlockFixture({
        completedAt: SESSION_NOW,
        kind: "review",
        position: 0,
        sessionId: session.id,
        status: "completed",
      }),
      studySessionBlockFixture({ kind: "review", position: 1, sessionId: session.id }),
      learningProfileFixture({ dailyLimitMinutes: 15, userId: user.id }),
      prisma.dailyProgress.create({
        data: {
          date: toUTCMidnight(SESSION_NOW),
          dayOfWeek: 0,
          timeSpentSeconds: 900,
          userId: user.id,
        },
      }),
    ]);

    await expect(tap(done)).resolves.toStrictEqual({
      opening: { blockId: null, kind: "session" },
      status: "ready",
    });

    await expect(tap(review)).resolves.toStrictEqual({
      opening: { kind: "today" },
      status: "ready",
    });

    await expect(readBlock(review)).resolves.toMatchObject({ status: "pending" });
  });

  it("opens a challenge on its own screen without starting it, and prepares the session", async () => {
    const { session } = await learnerSession();

    const [boss, mock] = await Promise.all([
      studySessionBlockFixture({
        kind: "checkpoint",
        payload: { checkpoint: BOSS, itemIds: [] },
        position: 0,
        sessionId: session.id,
      }),
      studySessionBlockFixture({
        kind: "checkpoint",
        payload: {
          checkpoint: {
            ...BOSS,
            kind: "weekly",
            mock: true,
            mockIdentity: { day: 1, fullLength: false },
          },
          itemIds: [],
        },
        position: 1,
        sessionId: session.id,
      }),
    ]);

    await expect(tap(boss)).resolves.toStrictEqual({
      opening: { blockId: boss.id, kind: "checkpoint", sessionId: session.id },
      status: "ready",
    });

    await expect(tap(mock)).resolves.toStrictEqual({
      opening: { blockId: mock.id, kind: "mock", sessionId: session.id },
      status: "ready",
    });

    await expect(readBlock(boss)).resolves.toMatchObject({ status: "pending" });
    await expect(owedPreparations(session.id)).resolves.toBe(1);
  });

  it("opens a planned challenge that isn't a language call on its intro", async () => {
    const { plan, session } = await goalDaySession();

    const planItem = await planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: 9,
    });

    const block = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: { checkpoint: BOSS, itemIds: [], planItemId: planItem.id },
      sessionId: session.id,
    });

    await expect(mission(block)).resolves.toStrictEqual({
      opening: { kind: "challenge", planItemId: planItem.id, sessionId: session.id },
      status: "ready",
    });
  });

  it("Continue opens the next step, but never a mock the learner didn't see", async () => {
    const { session } = await learnerSession();

    const [review, mock] = await Promise.all([
      studySessionBlockFixture({ kind: "review", position: 0, sessionId: session.id }),
      studySessionBlockFixture({
        kind: "checkpoint",
        payload: {
          checkpoint: {
            ...BOSS,
            kind: "weekly",
            mock: true,
            mockIdentity: { day: 1, fullLength: false },
          },
          itemIds: [],
        },
        position: 1,
        sessionId: session.id,
      }),
    ]);

    await prisma.studySessionBlock.update({
      data: { completedAt: SESSION_NOW, status: "completed" },
      where: { id: review.id },
    });

    await expect(
      openStudyBlock({
        target: { expectedBlockId: review.id, kind: "next", sessionId: session.id },
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({ opening: { kind: "changed" }, status: "ready" });

    await expect(
      openStudyBlock({
        target: { expectedBlockId: mock.id, kind: "next", sessionId: session.id },
        timeZone: "UTC",
      }),
    ).resolves.toStrictEqual({
      opening: { blockId: mock.id, kind: "mock", sessionId: session.id },
      status: "ready",
    });

    await expect(readBlock(mock)).resolves.toMatchObject({ status: "pending" });
  });

  it("Continue goes back to Today on a day that's over", async () => {
    const user = await userFixture();

    const session = await studySessionFixture({
      localDate: new Date("2026-09-20T00:00:00Z"),
      userId: user.id,
    });

    await studySessionBlockFixture({ kind: "review", sessionId: session.id });
    mockSession(user.id);

    await expect(
      openStudyBlock({ target: { kind: "next", sessionId: session.id }, timeZone: "UTC" }),
    ).resolves.toStrictEqual({ opening: { kind: "today" }, status: "ready" });
  });

  it("a mission opens only a block still free to start", async () => {
    const { session } = await goalDaySession();

    const [review, done] = await Promise.all([
      studySessionBlockFixture({ kind: "review", position: 0, sessionId: session.id }),
      studySessionBlockFixture({
        completedAt: SESSION_NOW,
        kind: "practice",
        position: 1,
        sessionId: session.id,
        status: "completed",
      }),
    ]);

    await expect(mission(done)).resolves.toStrictEqual({
      opening: { kind: "changed" },
      status: "ready",
    });

    await expect(mission(review)).resolves.toStrictEqual({
      opening: { blockId: review.id, kind: "session" },
      status: "ready",
    });
  });

  it("opens nothing for a signed-out visitor or another learner's block", async () => {
    const { session } = await learnerSession();
    const block = await studySessionBlockFixture({ kind: "review", sessionId: session.id });
    const stranger = await userFixture();

    mockSession(stranger.id);

    await expect(tap(block)).resolves.toStrictEqual({ status: "notFound" });

    await expect(mission(block)).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      openStudyBlock({ target: { kind: "next", sessionId: session.id }, timeZone: "UTC" }),
    ).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);
    await expect(tap(block)).resolves.toStrictEqual({ status: "unauthorized" });
    await expect(readBlock(block)).resolves.toMatchObject({ status: "pending" });
  });

  it("opening a day not saved yet opens its next step in the same request", async () => {
    const user = await userFixture();
    const { goal } = await sessionGoalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const day = { goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" };
    const opened = await openStudyDay({ ...day, target: { kind: "next", shown: null } });

    if (opened.status !== "opened" || !opened.target) {
      throw new Error("Expected the day's next step");
    }

    const { lessonId } = opened.target;

    expect(opened).toMatchObject({
      opening: { blockId: opened.target.id, kind: "unwrittenLesson", lessonId },
      targetStatus: "next",
    });

    await expect(openStudyDay(day)).resolves.toMatchObject({ opening: null, targetStatus: null });
  });
});
