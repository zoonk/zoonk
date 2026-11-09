import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { readBlockPayload } from "../sessions/block-payload";
import { startStudyBlock } from "../sessions/start-study-block";
import { setupPlayableLesson } from "./_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "./complete-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";
import { updateLessonClock } from "./update-lesson-clock";

const NOW = new Date("2026-11-08T12:00:00Z");

function at(minutes: number) {
  vi.setSystemTime(new Date(NOW.getTime() + minutes * 60_000));
}

async function setup() {
  freezeClock();
  vi.setSystemTime(NOW);
  const { lesson, user } = await setupPlayableLesson({ steps: ["explanation", "summary"] });
  const session = await studySessionFixture({ userId: user.id });

  const block = await studySessionBlockFixture({
    kind: "learn",
    lessonId: lesson.id,
    sessionId: session.id,
  });

  await startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });

  const started = await startLibraryLesson({
    input: { studySessionId: session.id, timeZone: "UTC" },
    lessonId: lesson.id,
  });

  if (started.status !== "started" || !started.run.clockId) {
    throw new Error("Expected a running lesson clock");
  }

  const input = { clockId: started.run.clockId, runId: started.run.runId };

  const transition = (state: "paused" | "running", sequence: number) =>
    updateLessonClock({ input: { ...input, sequence, state }, lessonId: lesson.id });

  const finish = () =>
    completeLibraryLesson({ input: { runId: input.runId, timeZone: "UTC" }, lessonId: lesson.id });

  const timing = async () =>
    readBlockPayload(await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }))
      .timing;

  return { block, finish, input, lesson, session, timing, transition, user };
}

describe(updateLessonClock, () => {
  it("excludes time away through pause, resume and completion, and credits it once", async () => {
    const { finish, timing, transition } = await setup();
    at(2);
    await expect(transition("paused", 1)).resolves.toStrictEqual({ status: "updated" });
    at(62);
    await expect(transition("running", 2)).resolves.toStrictEqual({ status: "updated" });
    at(65);

    await expect(finish()).resolves.toMatchObject({
      completion: { seconds: 300 },
      status: "completed",
    });

    await expect(timing()).resolves.toMatchObject({
      activeAt: null,
      elapsedMs: 300_000,
      recordedMs: 300_000,
    });

    await expect(finish()).resolves.toMatchObject({
      completion: { seconds: 300 },
      status: "completed",
    });

    await expect(transition("paused", 3)).resolves.toStrictEqual({ status: "ignored" });
  });

  it("finishes while paused without charging time away", async () => {
    const { finish, timing, transition } = await setup();
    at(3);
    await transition("paused", 1);
    at(70);

    await expect(finish()).resolves.toMatchObject({
      completion: { seconds: 180 },
      status: "completed",
    });

    await expect(timing()).resolves.toMatchObject({ activeAt: null, recordedMs: 180_000 });
  });

  it("ignores duplicate and out-of-order transitions", async () => {
    const { finish, timing, transition } = await setup();
    at(2);
    await transition("paused", 1);
    at(5);
    await expect(transition("paused", 1)).resolves.toStrictEqual({ status: "ignored" });
    at(12);
    await transition("running", 4);
    const current = await timing();
    await expect(transition("paused", 3)).resolves.toStrictEqual({ status: "ignored" });
    await expect(timing()).resolves.toStrictEqual(current);
    at(14);

    await expect(finish()).resolves.toMatchObject({
      completion: { seconds: 240 },
      status: "completed",
    });
  });

  it("does not pause another device's interval of the same run", async () => {
    const { finish, input, lesson, timing, transition } = await setup();
    at(2);

    const newer = await startLibraryLesson({
      input: { runId: input.runId, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(newer).toMatchObject({ run: { runId: input.runId }, status: "started" });

    if (newer.status !== "started") {
      throw new Error(newer.status);
    }

    expect(newer.run.clockId).not.toBe(input.clockId);
    const current = await timing();
    at(5);
    await expect(transition("paused", 1)).resolves.toStrictEqual({ status: "ignored" });
    await expect(timing()).resolves.toStrictEqual(current);
    at(7);

    await expect(finish()).resolves.toMatchObject({
      completion: { seconds: 420 },
      status: "completed",
    });
  });

  it("ignores an earlier run's clock after a later run starts", async () => {
    const { input, lesson, session, timing, transition } = await setup();
    at(31);

    const newer = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (newer.status !== "started") {
      throw new Error(newer.status);
    }

    expect(newer.run.runId).not.toBe(input.runId);
    const current = await timing();
    await expect(transition("paused", 1)).resolves.toStrictEqual({ status: "ignored" });
    await expect(timing()).resolves.toStrictEqual(current);
  });

  it("Start resumes a paused block bound to no live clock", async () => {
    const { lesson, session, transition } = await setup();
    at(2);
    await transition("paused", 1);
    at(40);

    const again = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(again.status === "started" && again.run.clockId).toBeTruthy();
    at(50);

    await expect(
      completeLibraryLesson({
        input: { runId: again.status === "started" ? again.run.runId : "", timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ completion: { seconds: 720 }, status: "completed" });
  });

  it("Start resumes the lesson after another block opened and pauses that block", async () => {
    const { lesson, session, timing } = await setup();

    const other = await studySessionBlockFixture({
      kind: "practice",
      position: 1,
      sessionId: session.id,
    });

    at(2);
    await startStudyBlock({ blockId: other.id, input: { timeZone: "UTC" }, sessionId: session.id });
    at(10);

    const again = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    expect(again.status === "started" && again.run.clockId).toBeTruthy();

    expect(
      readBlockPayload(
        await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } }),
      ).timing,
    ).toMatchObject({ activeAt: null, clock: null, elapsedMs: 480_000 });

    await expect(timing()).resolves.toMatchObject({
      activeAt: new Date(NOW.getTime() + 600_000).toISOString(),
    });

    at(20);

    await expect(
      completeLibraryLesson({
        input: { runId: again.status === "started" ? again.run.runId : "", timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ completion: { seconds: 720 }, status: "completed" });
  });

  it("does not revive a clock after another block opens", async () => {
    const { finish, session, timing, transition } = await setup();

    const other = await studySessionBlockFixture({
      kind: "practice",
      position: 1,
      sessionId: session.id,
    });

    at(2);
    await startStudyBlock({ blockId: other.id, input: { timeZone: "UTC" }, sessionId: session.id });
    const current = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } });
    at(8);
    await expect(transition("running", 1)).resolves.toStrictEqual({ status: "ignored" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } }),
    ).resolves.toStrictEqual(current);

    await expect(timing()).resolves.toMatchObject({ activeAt: null, elapsedMs: 120_000 });

    await expect(finish()).resolves.toMatchObject({
      completion: { seconds: 120 },
      status: "completed",
    });
  });

  it("binds the currently opened block when a lesson appears twice", async () => {
    const { block, input, lesson, session } = await setup();

    const duplicate = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      position: 1,
      sessionId: session.id,
    });

    at(2);

    await startStudyBlock({
      blockId: duplicate.id,
      input: { timeZone: "UTC" },
      sessionId: session.id,
    });

    const newer = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (newer.status !== "started") {
      throw new Error(newer.status);
    }

    const first = readBlockPayload(
      await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).timing;

    const second = readBlockPayload(
      await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: duplicate.id } }),
    ).timing;

    expect(newer.run.runId).toBe(input.runId);
    expect(first).toMatchObject({ activeAt: null, clock: null, elapsedMs: 120_000 });
    expect(second?.clock?.id).toBe(newer.run.clockId);
  });

  it("authorizes the run and refuses forged identifiers without changing its clock", async () => {
    const { input, lesson, timing, transition } = await setup();
    const current = await timing();

    await expect(
      updateLessonClock({
        input: { ...input, runId: randomUUID(), sequence: 1, state: "paused" },
        lessonId: lesson.id,
      }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      updateLessonClock({
        input: { ...input, clockId: randomUUID(), sequence: 1, state: "paused" },
        lessonId: lesson.id,
      }),
    ).resolves.toStrictEqual({ status: "ignored" });

    const other = await userFixture();
    mockSession(other.id);
    await expect(transition("paused", 1)).resolves.toStrictEqual({ status: "notFound" });
    mockSession(null);
    await expect(transition("paused", 1)).resolves.toStrictEqual({ status: "unauthorized" });
    await expect(timing()).resolves.toStrictEqual(current);
  });

  it("normalizes clock identifiers for direct core callers", async () => {
    const { input, lesson } = await setup();

    await expect(
      updateLessonClock({
        input: {
          clockId: input.clockId.toUpperCase(),
          runId: input.runId.toUpperCase(),
          sequence: 1,
          state: "paused",
        },
        lessonId: lesson.id,
      }),
    ).resolves.toStrictEqual({ status: "updated" });
  });

  it("serializes simultaneous duplicate transitions", async () => {
    const { timing, transition, user } = await setup();
    at(2);
    const hold = holdLearnerLock({ userId: user.id });
    const pid = await hold.pid;

    const pending = Promise.all([
      transition("paused", 1),
      transition("paused", 1),
      transition("paused", 1),
    ]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 3);
    } finally {
      hold.release();
      await hold.done;
    }

    const results = await pending;
    expect(results.filter((result) => result.status === "updated")).toHaveLength(1);
    expect(results.filter((result) => result.status === "ignored")).toHaveLength(2);

    await expect(timing()).resolves.toMatchObject({
      activeAt: null,
      clock: { sequence: 1 },
      elapsedMs: 120_000,
    });
  });
});
