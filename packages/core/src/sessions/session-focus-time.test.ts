import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { setupPlayableLesson } from "../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { readBlockPayload, toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2026-10-13T12:00:00Z");
const MINUTE = 60_000;

async function setup() {
  freezeClock();
  vi.setSystemTime(NOW);
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const session = await studySessionFixture({ userId: user.id });

  const items = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
  ]);

  const blocks = await Promise.all(
    items.map((item, position) =>
      studySessionBlockFixture({
        estimatedMinutes: 10,
        kind: "practice",
        payload: toBlockPayload({ itemIds: [item.id] }),
        position,
        sessionId: session.id,
      }),
    ),
  );

  await Promise.all(
    items.map((item) =>
      attemptFixture({
        answer: { selectedIndex: 0 },
        isCorrect: true,
        itemId: item.id,
        studySessionId: session.id,
        userId: user.id,
      }),
    ),
  );

  mockSession(user.id);

  const start = async (index: number) => {
    await expect(
      startStudyBlock({
        blockId: blocks[index]?.id ?? "",
        input: { timeZone: "UTC" },
        sessionId: session.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });
  };

  const finish = async (index: number) => {
    await expect(
      finishStudyBlock({
        blockId: blocks[index]?.id ?? "",
        input: { timeZone: "UTC" },
        sessionId: session.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });
  };

  const seconds = async () => {
    const progress = await prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } });
    return progress.timeSpentSeconds;
  };

  return { blocks, finish, seconds, session, start, user };
}

function at(minutes: number) {
  vi.setSystemTime(new Date(NOW.getTime() + minutes * MINUTE));
}

describe("session focus time", () => {
  it("does not revive a skipped block's clock when Undo restores its active status", async () => {
    const { blocks, finish, seconds, start } = await setup();
    await start(0);
    at(2);

    await prisma.studySessionBlock.update({
      data: { status: "skipped" },
      where: { id: blocks[0]?.id },
    });

    at(4);
    await start(1);
    at(5);

    await prisma.studySessionBlock.update({
      data: { status: "active" },
      where: { id: blocks[0]?.id },
    });

    at(7);
    await finish(0);
    await finish(1);
    await expect(seconds()).resolves.toBe(420);
  });

  it("pauses the earlier clock across different owned sessions", async () => {
    const { blocks, finish, seconds, session, start, user } = await setup();
    const other = await studySessionFixture({ userId: user.id });
    const second = blocks[1];

    if (!second) {
      throw new Error("Missing second block");
    }

    await prisma.studySessionBlock.update({
      data: { sessionId: other.id },
      where: { id: second.id },
    });

    await prisma.attempt.updateMany({
      data: { studySessionId: other.id },
      where: { itemId: { in: readBlockPayload(second).itemIds }, userId: user.id },
    });

    await start(0);
    at(4);

    await expect(
      startStudyBlock({ blockId: second.id, input: { timeZone: "UTC" }, sessionId: other.id }),
    ).resolves.toMatchObject({ status: "ready" });

    at(9);
    await finish(0);

    await expect(
      finishStudyBlock({ blockId: second.id, input: { timeZone: "UTC" }, sessionId: other.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(seconds()).resolves.toBe(540);

    await expect(
      prisma.learningEvent.findFirstOrThrow({
        where: {
          contentIds: { equals: session.id, path: ["studySessionId"] },
          kind: "session",
          userId: user.id,
        },
      }),
    ).resolves.toMatchObject({ seconds: 240 });

    await expect(
      prisma.learningEvent.findFirstOrThrow({
        where: {
          contentIds: { equals: other.id, path: ["studySessionId"] },
          kind: "session",
          userId: user.id,
        },
      }),
    ).resolves.toMatchObject({ seconds: 300 });
  });

  it("pauses a session lesson's own ledger clock when the learner switches to practice", async () => {
    freezeClock();
    vi.setSystemTime(NOW);
    const { lesson, user } = await setupPlayableLesson({ steps: ["explanation", "summary"] });
    const session = await studySessionFixture({ userId: user.id });
    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

    const lessonBlock = await studySessionBlockFixture({
      kind: "learn",
      lessonId: lesson.id,
      position: 0,
      sessionId: session.id,
    });

    const practice = await studySessionBlockFixture({
      estimatedMinutes: 10,
      kind: "practice",
      payload: toBlockPayload({ itemIds: [item.id] }),
      position: 1,
      sessionId: session.id,
    });

    await attemptFixture({
      answer: { selectedIndex: 0 },
      isCorrect: true,
      itemId: item.id,
      studySessionId: session.id,
      userId: user.id,
    });

    await startStudyBlock({
      blockId: lessonBlock.id,
      input: { timeZone: "UTC" },
      sessionId: session.id,
    });

    const run = await startLibraryLesson({
      input: { studySessionId: session.id, timeZone: "UTC" },
      lessonId: lesson.id,
    });

    if (run.status !== "started") {
      throw new Error(run.status);
    }

    at(3);

    await startStudyBlock({
      blockId: practice.id,
      input: { timeZone: "UTC" },
      sessionId: session.id,
    });

    at(8);

    await expect(
      completeLibraryLesson({
        input: { runId: run.run.runId, timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).resolves.toMatchObject({ completion: { seconds: 180 }, status: "completed" });

    await expect(
      finishStudyBlock({ blockId: practice.id, input: { timeZone: "UTC" }, sessionId: session.id }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ timeSpentSeconds: 480 });

    await expect(
      prisma.learningEvent.findFirstOrThrow({ where: { kind: "session", userId: user.id } }),
    ).resolves.toMatchObject({ seconds: 480 });
  });

  it("counts time once when a learner leaves one block active and opens another", async () => {
    const { finish, seconds, start, user } = await setup();
    await start(0);
    at(5);
    await start(1);
    at(10);
    await finish(0);
    await finish(1);
    await expect(seconds()).resolves.toBe(600);

    const ledger = await prisma.learningEvent.findMany({
      where: { kind: "questions", userId: user.id },
    });

    expect(ledger.map((row) => row.seconds).toSorted((a, b) => a - b)).toStrictEqual([300, 300]);

    await expect(
      prisma.learningEvent.findFirstOrThrow({ where: { kind: "session", userId: user.id } }),
    ).resolves.toMatchObject({ seconds: 600 });
  });

  it("keeps accrued time through repeated switches and resumes without charging time away", async () => {
    const { finish, seconds, start } = await setup();
    await start(0);
    at(2);
    await start(1);
    at(5);
    await start(0);
    at(7);
    await finish(0);
    at(12);
    await finish(1);
    await expect(seconds()).resolves.toBe(420);
  });

  it("serializes simultaneous starts and preserves the newest clock when completion races a switch", async () => {
    const { finish, seconds, start } = await setup();
    await Promise.all([start(0), start(1)]);
    at(5);
    await Promise.all([start(1), finish(0)]);
    at(10);
    await finish(1);
    await expect(seconds()).resolves.toBeLessThanOrEqual(600);
    await expect(seconds()).resolves.toBeGreaterThanOrEqual(300);
  });
});
