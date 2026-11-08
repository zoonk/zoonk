import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { runOwedSettlements } from "./_test-utils/owed-settlements";
import { skipTestedOutBlocks } from "./_utils/skip-tested-out-blocks";
import { readBlockPayload, toBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2026-09-30T12:00:00Z");

async function setup({
  minutes = 100,
  queued = 10,
  lessons = 14,
}: { minutes?: number; queued?: number; lessons?: number } = {}) {
  freezeClock();
  vi.setSystemTime(NOW);

  const [user, playable] = await Promise.all([
    userFixture(),
    Promise.all(
      Array.from({ length: lessons }, () =>
        playableLessonFixture({
          lesson: { estimatedMinutes: 10 },
          steps: ["explanation", "summary"],
        }),
      ),
    ),
  ]);

  const goal = await goalFixture({ dailyMinutes: minutes, timezone: "UTC", userId: user.id });

  const plan = await planFixture({
    goalId: goal.id,
    items: playable.map(({ lesson }) => ({ lessonId: lesson.id, minutes: 10 })),
  });

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate: new Date("2026-09-30"),
    plannedMinutes: minutes,
    startedAt: NOW,
    status: "active",
    userId: user.id,
  });

  const blocks = await Promise.all(
    playable
      .slice(0, queued)
      .map(({ lesson }, position) =>
        studySessionBlockFixture({
          estimatedMinutes: 10,
          lessonId: lesson.id,
          payload: toBlockPayload({ planItemId: plan.items[position]?.id }),
          position,
          sessionId: session.id,
        }),
      ),
  );

  mockSession(user.id);
  return { blocks, goal, plan, playable, session, user };
}

async function finish({
  block,
  sessionId,
  elapsedMinutes,
}: {
  block: { id: string; lessonId: string | null };
  sessionId: string;
  elapsedMinutes: number;
}) {
  await startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId });

  const started = await startLibraryLesson({
    input: { studySessionId: sessionId, timeZone: "UTC" },
    lessonId: block.lessonId ?? "",
  });

  if (started.status !== "started") {
    throw new Error(started.status);
  }

  vi.setSystemTime(new Date(Date.now() + elapsedMinutes * 60_000));

  const complete = () =>
    completeLibraryLesson({
      input: { runId: started.run.runId, timeZone: "UTC" },
      lessonId: block.lessonId ?? "",
    });

  const outcome = await complete();

  if (outcome.status !== "completed" || !outcome.completion.studyBlock) {
    throw new Error(`No block completion: ${outcome.status}`);
  }

  return { complete, completion: outcome.completion.studyBlock };
}

describe("completion refits today's lessons", () => {
  it("finishes a 100-minute day after five 20-minute lessons and keeps deferred work todo", async () => {
    const fixture = await setup();

    for (const index of [0, 1, 2, 3, 4]) {
      const block = fixture.blocks[index]!;
      // oxlint-disable-next-line no-await-in-loop -- each completion consumes the queue returned by the preceding one
      const { completion } = await finish({
        block,
        elapsedMinutes: 20,
        sessionId: fixture.session.id,
      });

      expect(completion.minutes.left).toBe(100 - 20 * (index + 1));
      expect(completion.deferredLessonsCount).toBe(1);
      expect(completion.sessionCompleted).toBe(index === 4);
    }

    await expect(
      prisma.studySessionBlock.count({ where: { sessionId: fixture.session.id } }),
    ).resolves.toBe(5);

    await expect(
      prisma.planItem.count({ where: { kind: "lesson", planId: fixture.plan.id, status: "todo" } }),
    ).resolves.toBe(9);
  });

  it.each([
    { credited: 5, elapsedMinutes: 0 },
    { credited: 25, elapsedMinutes: 60 },
  ])(
    "clamps $elapsedMinutes measured minutes to $credited, replaying credit and deferral once",
    async ({ elapsedMinutes, credited }) => {
      const fixture = await setup();
      const block = fixture.blocks[0]!;

      const { complete, completion } = await finish({
        block,
        elapsedMinutes,
        sessionId: fixture.session.id,
      });

      expect(completion.minutes.left).toBe(100 - credited);
      const replay = await complete();

      expect(replay.status === "completed" && replay.completion.studyBlock).toMatchObject({
        deferredLessonsCount: completion.deferredLessonsCount,
        minutes: completion.minutes,
      });

      const saved = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
      expect(readBlockPayload(saved).creditedMinutes).toBe(credited);
    },
  );

  it("appends the next lesson when a fast completion makes room", async () => {
    const fixture = await setup({ minutes: 20, queued: 2 });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 0,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks).toHaveLength(2);

    const next = await finish({
      block: fixture.blocks[1]!,
      elapsedMinutes: 0,
      sessionId: fixture.session.id,
    });

    expect(next.completion.blocks).toHaveLength(3);
    expect(next.completion.next?.block.lessonId).toBe(fixture.playable[2]?.lesson.id);
    expect(next.completion.deferredLessonsCount).toBe(0);
  });

  it("retains another device's active lesson and deliberate extra/reinforcement work", async () => {
    const fixture = await setup({ minutes: 30, queued: 3 });

    await prisma.studySessionBlock.update({
      data: { startedAt: NOW, status: "active" },
      where: { id: fixture.blocks[2]?.id },
    });

    const extra = await studySessionBlockFixture({
      estimatedMinutes: 10,
      payload: toBlockPayload({ extra: true }),
      position: 3,
      sessionId: fixture.session.id,
    });

    const reinforcement = await studySessionBlockFixture({
      estimatedMinutes: 10,
      payload: toBlockPayload({ reinforcement: true }),
      position: 4,
      sessionId: fixture.session.id,
    });

    const previouslyStarted = await studySessionBlockFixture({
      estimatedMinutes: 10,
      lessonId: fixture.playable[3]?.lesson.id,
      position: 5,
      sessionId: fixture.session.id,
      startedAt: NOW,
    });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 25,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks.map((block) => block.id)).toContain(fixture.blocks[2]?.id);
    expect(completion.blocks.map((block) => block.id)).toContain(extra.id);
    expect(completion.blocks.map((block) => block.id)).toContain(reinforcement.id);
    expect(completion.blocks.map((block) => block.id)).toContain(previouslyStarted.id);
    expect(completion.deferredLessonsCount).toBe(1);
  });

  it("replaces a tested-out lesson before ending the day, without debiting skipped minutes", async () => {
    const fixture = await setup({ minutes: 10, queued: 1 });
    const item = fixture.plan.items[0]!;

    await prisma.planItem.update({
      data: { completedAt: NOW, status: "testedOut" },
      where: { id: item.id },
    });

    await skipTestedOutBlocks({
      goalId: fixture.goal.id,
      notStarted: true,
      planItemIds: [item.id],
    });

    await runOwedSettlements(fixture.user.id);

    const saved = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true },
      where: { id: fixture.session.id },
    });

    expect(saved.status).toBe("active");
    expect(saved.plannedMinutes).toBe(10);

    expect(saved.blocks.find((block) => block.status === "pending")?.lessonId).toBe(
      fixture.playable[1]?.lesson.id,
    );
  });
});
