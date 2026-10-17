import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { setupPlayableLesson } from "../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { startStudyBlock } from "./start-study-block";

describe("session lesson focus settlement", () => {
  it("replays the bound lesson's evidence when a later run finished for another block", async () => {
    freezeClock();
    const now = new Date();
    const { lesson, user } = await setupPlayableLesson({ steps: ["explanation", "summary"] });
    const session = await studySessionFixture({ userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      sessionId: session.id,
    });

    await startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

    const run = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (run.status !== "started") {
      throw new Error(run.status);
    }

    const input = { input: { runId: run.run.runId, timeZone: "UTC" }, lessonId: lesson.id };
    const first = await completeLibraryLesson(input);

    if (first.status !== "completed") {
      throw new Error(first.status);
    }

    vi.setSystemTime(new Date(now.getTime() + 60_000));

    await learningEventFixture({
      brainPower: 73,
      contentIds: { lessonId: lesson.id, studySessionBlockId: crypto.randomUUID() },
      correctAnswers: 9,
      endedAt: new Date(),
      kind: "review",
      seconds: 999,
      userId: user.id,
    });

    await expect(completeLibraryLesson(input)).resolves.toMatchObject({
      completion: { studyBlock: { brainPower: first.completion.brainPower, correct: 0, total: 0 } },
      status: "completed",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toMatchObject({ brainPower: first.completion.brainPower });
  });

  it("credits a session lesson's focused duration once when distinct runs finish before its block settles", async () => {
    freezeClock();
    const now = new Date("2026-10-13T12:00:00Z");
    vi.setSystemTime(now);
    const { lesson, user } = await setupPlayableLesson({ steps: ["explanation", "summary"] });
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    const item = await planItemFixture({ kind: "lesson", lessonId: lesson.id, planId: plan.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    const block = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      payload: { planItemId: item.id },
      sessionId: session.id,
    });

    await expect(
      startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });

    const first = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    vi.setSystemTime(new Date(now.getTime() + 31 * 60_000));

    const second = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (first.status !== "started" || second.status !== "started") {
      throw new Error("Expected two starts");
    }

    expect(first.run.runId).not.toBe(second.run.runId);
    const runIds = [first.run.runId, second.run.runId];
    const ready = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    const holding = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM plan_items WHERE id = ${item.id}::uuid FOR UPDATE`;
        ready.resolve(null);
        await release.promise;
      },
      { timeout: 12_000 },
    );

    const held = Promise.allSettled([holding]);
    void holding.catch(ready.reject);
    await ready.promise;

    const completions = Promise.allSettled(
      runIds.map((runId) =>
        completeLibraryLesson({ input: { runId, timeZone: "UTC" }, lessonId: lesson.id }),
      ),
    );

    try {
      // Holding the plan item blocks automatic settlement after each run has published its time.
      await expect
        .poll(
          () =>
            prisma.learningEvent.count({ where: { endedAt: { not: null }, id: { in: runIds } } }),
          { interval: 10, timeout: 4000 },
        )
        .toBe(2);
    } finally {
      release.resolve(null);
      await held;
    }

    const results = await completions;
    expect(results.map((result) => result.status)).toStrictEqual(["fulfilled", "fulfilled"]);
    const rows = await prisma.learningEvent.findMany({ where: { id: { in: runIds } } });
    expect(rows.reduce((sum, row) => sum + row.seconds, 0)).toBe(1800);

    await expect(
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ timeSpentSeconds: 1800 });

    await expect(
      prisma.learningEvent.findFirstOrThrow({
        where: {
          contentIds: { equals: session.id, path: ["studySessionId"] },
          kind: "session",
          userId: user.id,
        },
      }),
    ).resolves.toMatchObject({ seconds: 1800 });
  });
});
