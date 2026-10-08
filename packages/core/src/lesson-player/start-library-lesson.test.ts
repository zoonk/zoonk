import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { RATE_LIMIT_RETRY_SECONDS } from "../entitlements/limits";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { startLibraryLesson } from "./start-library-lesson";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

const TIME_ZONE = "America/Sao_Paulo";

function start(lessonId: string, studySessionId?: string) {
  return startLibraryLesson({ input: { studySessionId, timeZone: TIME_ZONE }, lessonId });
}

describe(startLibraryLesson, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("needs a session", async () => {
    mockSession(null);

    await expect(start(randomUUID())).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("opens a run in the ledger, still unfinished", async () => {
    const { lesson, user } = await setupPlayableLesson();

    const outcome = await start(lesson.id);

    expect(outcome.status).toBe("started");

    const runId = outcome.status === "started" ? outcome.run.runId : "";
    const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });

    expect(run).toMatchObject({
      contentIds: { lessonId: lesson.id },
      endedAt: null,
      kind: "lesson",
      lessonKind: "library",
      titleSnapshot: lesson.title,
      userId: user.id,
    });

    expect(outcome.status === "started" && outcome.run.startedAt).toBe(run.startedAt.toISOString());
  });

  it("resumes the open run on a second start and counts the lesson once", async () => {
    const { lesson, user } = await setupPlayableLesson();

    const [first, second] = await Promise.all([start(lesson.id), start(lesson.id)]);

    expect(first.status === "started" && first.run.runId).toBe(
      second.status === "started" && second.run.runId,
    );

    const [runs, usage] = await Promise.all([
      prisma.learningEvent.count({ where: { userId: user.id } }),
      prisma.usageRecord.count({
        where: { kind: "lessonStart", targetId: lesson.id, userId: user.id },
      }),
    ]);

    expect({ runs, usage }).toStrictEqual({ runs: 1, usage: 1 });
  });

  it("resumes the open run with its answers in order, and Hyperdrive as it stood when it started", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const check = stepOfKind(steps, "check");
    const typed = stepOfKind(steps, "typedAnswer");
    const first = await start(lesson.id);

    expect(first.status === "started" && first.run.answers).toStrictEqual([]);

    const startedAt = Date.now();

    await Promise.all([
      attemptFixture({ answeredAt: new Date(startedAt + 1000), stepId: check.id, userId: user.id }),
      attemptFixture({
        answeredAt: new Date(startedAt + 2000),
        isCorrect: false,
        stepId: typed.id,
        userId: user.id,
      }),
    ]);

    const resumed = await start(lesson.id);

    expect(resumed.status === "started" && resumed.run).toMatchObject({
      answers: [
        { answeredAt: new Date(startedAt + 1000).toISOString(), isCorrect: true, stepId: check.id },
        { isCorrect: false, stepId: typed.id },
      ],
      hyperdrive: { knownStepIds: [], streak: 0 },
      runId: first.status === "started" ? first.run.runId : "",
    });
  });

  it("continues a lesson left unfinished days ago in a new run, with today's Hyperdrive", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const check = stepOfKind(steps, "check");
    const earlier = await playableLessonFixture({ steps: ["check", "typedAnswer"] });

    const [yesterday, today] = await Promise.all([
      studySessionFixture({ userId: user.id }),
      studySessionFixture({ userId: user.id }),
    ]);

    const leftAt = Date.now() - 2 * MS_PER_DAY;

    const left = await lessonRunFixture({
      lessonId: lesson.id,
      startedAt: new Date(leftAt),
      studySessionId: yesterday.id,
      userId: user.id,
    });

    await Promise.all([
      // Yesterday's streak in its own session, which must not carry into today's.
      attemptFixture({
        answeredAt: new Date(leftAt + 1000),
        stepId: check.id,
        studySessionId: yesterday.id,
        userId: user.id,
      }),
      studySessionBlockFixture({ lessonId: lesson.id, sessionId: today.id }),
      ...earlier.steps.map((step, index) =>
        attemptFixture({
          answeredAt: new Date(Date.now() - (10 - index) * 1000),
          stepId: step.id,
          studySessionId: today.id,
          userId: user.id,
        }),
      ),
    ]);

    const outcome = await start(lesson.id, today.id);

    expect(outcome.status === "started" && outcome.run).toMatchObject({
      answers: [
        { answeredAt: new Date(leftAt + 1000).toISOString(), isCorrect: true, stepId: check.id },
      ],
      hyperdrive: { knownStepIds: [check.id], streak: 2 },
    });

    expect(outcome.status === "started" && outcome.run.runId).not.toBe(left.id);
  });

  it("starts over a lesson left more than a week ago, or one finished since", async () => {
    const [stale, finished] = await Promise.all([setupPlayableLesson(), setupPlayableLesson()]);

    const leave = async ({ daysAgo, setup }: { daysAgo: number; setup: typeof stale }) => {
      const startedAt = new Date(Date.now() - daysAgo * MS_PER_DAY);
      await lessonRunFixture({ lessonId: setup.lesson.id, startedAt, userId: setup.user.id });

      await attemptFixture({
        answeredAt: new Date(startedAt.getTime() + 1000),
        stepId: stepOfKind(setup.steps, "check").id,
        userId: setup.user.id,
      });
    };

    await Promise.all([
      leave({ daysAgo: 8, setup: stale }),
      leave({ daysAgo: 2, setup: finished }),
      lessonRunFixture({
        endedAt: new Date(Date.now() - MS_PER_DAY),
        lessonId: finished.lesson.id,
        startedAt: new Date(Date.now() - MS_PER_DAY - 60_000),
        userId: finished.user.id,
      }),
    ]);

    mockSession(stale.user.id);
    const staleRun = await start(stale.lesson.id);

    mockSession(finished.user.id);
    const replay = await start(finished.lesson.id);

    expect(staleRun.status === "started" && staleRun.run.answers).toStrictEqual([]);
    expect(replay.status === "started" && replay.run.answers).toStrictEqual([]);
  });

  it("opens a new run once the last one finished, without counting the lesson again", async () => {
    const { lesson, user } = await setupPlayableLesson();

    const first = await start(lesson.id);
    const firstRunId = first.status === "started" ? first.run.runId : "";

    await prisma.learningEvent.update({ data: { endedAt: new Date() }, where: { id: firstRunId } });

    const second = await start(lesson.id);

    expect(second.status === "started" && second.run.runId).not.toBe(firstRunId);

    await expect(
      prisma.usageRecord.count({
        where: { kind: "lessonStart", targetId: lesson.id, userId: user.id },
      }),
    ).resolves.toBe(1);
  });

  it("starts a session block inside its session and continues the session's Hyperdrive", async () => {
    const { lesson, user } = await setupPlayableLesson();
    const earlier = await playableLessonFixture();
    const session = await studySessionFixture({ userId: user.id });
    await studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id });

    await Promise.all(
      earlier.steps
        .filter((step) => step.kind === "check" || step.kind === "typedAnswer")
        .map((step, index) =>
          attemptFixture({
            answeredAt: new Date(Date.now() - (10 - index) * 1000),
            stepId: step.id,
            studySessionId: session.id,
            userId: user.id,
          }),
        ),
    );

    const outcome = await start(lesson.id, session.id);
    const runId = outcome.status === "started" ? outcome.run.runId : "";
    const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });

    expect(run.contentIds).toMatchObject({ lessonId: lesson.id, studySessionId: session.id });

    expect(outcome.status === "started" && outcome.run.hyperdrive).toStrictEqual({
      knownStepIds: [],
      streak: 2,
    });
  });

  it("plays outside a session the lesson isn't part of, or someone else's", async () => {
    const { lesson, user } = await setupPlayableLesson();
    const stranger = await userFixture();

    const [otherSession, strangerSession] = await Promise.all([
      studySessionFixture({ userId: user.id }),
      studySessionFixture({ userId: stranger.id }),
    ]);

    await studySessionBlockFixture({ lessonId: lesson.id, sessionId: strangerSession.id });

    const withoutBlock = await start(lesson.id, otherSession.id);
    const runId = withoutBlock.status === "started" ? withoutBlock.run.runId : "";

    await prisma.learningEvent.update({ data: { endedAt: new Date() }, where: { id: runId } });

    const withStrangerSession = await start(lesson.id, strangerSession.id);

    const runs = await prisma.learningEvent.findMany({
      orderBy: { startedAt: "asc" },
      where: { userId: user.id },
    });

    expect(runs.map((run) => run.contentIds)).toStrictEqual([
      { lessonId: lesson.id },
      { lessonId: lesson.id },
    ]);

    expect(
      withStrangerSession.status === "started" && withStrangerSession.run.hyperdrive,
    ).toStrictEqual({ knownStepIds: [], streak: 0 });
  });

  it("marks screens already answered right, since answering them again is a repeat", async () => {
    const { lesson, steps, user } = await setupPlayableLesson();
    const check = stepOfKind(steps, "check");
    const typed = stepOfKind(steps, "typedAnswer");

    await Promise.all([
      attemptFixture({ stepId: check.id, userId: user.id }),
      attemptFixture({ isCorrect: false, stepId: typed.id, userId: user.id }),
    ]);

    const outcome = await start(lesson.id);

    expect(outcome.status === "started" && outcome.run.hyperdrive).toStrictEqual({
      knownStepIds: [check.id],
      streak: 0,
    });
  });

  it("asks a guest to sign up after their three lessons", async () => {
    const { lesson, user } = await setupPlayableLesson({ guest: true });
    await usageRecordsFixture({ count: 3, kind: "lessonStart", userId: user.id });

    const outcome = await start(lesson.id);

    expect(outcome).toMatchObject({
      limit: { resource: "lessonStart", tier: "guest" },
      status: "limitReached",
    });

    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("plays the guest's own quick explanation without counting it as a lesson", async () => {
    const { lesson, user } = await setupPlayableLesson({ guest: true });
    const goal = await goalFixture({ kind: "explain", userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id }),
      usageRecordsFixture({ count: 3, kind: "lessonStart", userId: user.id }),
    ]);

    await expect(start(lesson.id)).resolves.toMatchObject({ status: "started" });

    await expect(
      prisma.usageRecord.count({ where: { kind: "lessonStart", targetId: lesson.id } }),
    ).resolves.toBe(0);
  });

  it("still slows down starting the guest's own quick explanation over and over", async () => {
    const { lesson, user } = await setupPlayableLesson({ guest: true });
    const goal = await goalFixture({ kind: "explain", userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    await planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id });
    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(start(lesson.id)).resolves.toStrictEqual({
      retryAfterSeconds: RATE_LIMIT_RETRY_SECONDS,
      status: "slowDown",
    });

    expect(isRateLimited).toHaveBeenCalledWith(expect.objectContaining({ rule: "lesson-start" }));
  });

  it("counts an explanation lesson from someone else's goal like any lesson", async () => {
    const [{ lesson, user }, owner] = await Promise.all([
      setupPlayableLesson({ guest: true }),
      userFixture(),
    ]);

    const goal = await goalFixture({ kind: "explain", userId: owner.id });
    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id }),
      usageRecordsFixture({ count: 3, kind: "lessonStart", userId: user.id }),
    ]);

    await expect(start(lesson.id)).resolves.toMatchObject({ status: "limitReached" });
  });

  it("asks the learner to slow down when fair use spaces starts out", async () => {
    const { lesson } = await setupPlayableLesson();
    vi.mocked(isRateLimited).mockResolvedValue(true);

    await expect(start(lesson.id)).resolves.toMatchObject({ status: "slowDown" });
  });

  it('sends "Lesson Started" once per run, with its goal and the learner\'s shared properties', async () => {
    const { lesson, user } = await setupPlayableLesson();
    const goal = await goalFixture({ userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    const flush = runDeferredWork();

    await start(lesson.id);
    await start(lesson.id);
    await flush();

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith({
      distinctId: user.id,
      name: "Lesson Started",
      properties: {
        goal_id: goal.id,
        lessonKind: "library",
        lesson_id: lesson.id,
        stepCount: await prisma.step.count({ where: { lessonId: lesson.id } }),
      },
      shared: expect.objectContaining({ goal_kind: "learn", is_guest: false }),
    });
  });

  it('sends "Guest Lesson Started" too when a guest opens a lesson', async () => {
    const { lesson } = await setupPlayableLesson({ guest: true });
    const flush = runDeferredWork();

    await start(lesson.id);
    await flush();

    expect(vi.mocked(trackServerEvent).mock.calls.map(([event]) => event.name)).toStrictEqual([
      "Lesson Started",
      "Guest Lesson Started",
    ]);

    expect(trackServerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Guest Lesson Started",
        properties: { lesson_id: lesson.id },
        shared: expect.objectContaining({ is_guest: true }),
      }),
    );
  });

  it("doesn't start a lesson without content, someone else's private lesson or a missing one", async () => {
    const [user, owner] = await Promise.all([userFixture(), userFixture()]);

    const [unwritten, privateLesson] = await Promise.all([
      libraryLessonFixture(),
      playableLessonFixture({ lesson: { ownerId: owner.id, visibility: "private" } }),
    ]);

    mockSession(user.id);

    await expect(start(unwritten.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(start(privateLesson.lesson.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(start(randomUUID())).resolves.toStrictEqual({ status: "notFound" });
    await expect(start("not-a-uuid")).resolves.toStrictEqual({ status: "notFound" });
  });
});
