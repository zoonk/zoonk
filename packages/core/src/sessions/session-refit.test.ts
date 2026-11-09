import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
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
import { loadPlanAtToken } from "../plans/_utils/plan-token";
import { runOwedSettlements } from "./_test-utils/owed-settlements";
import { appendLandedLessons } from "./_utils/append-landed-lessons";
import { savedSelection } from "./_utils/saved-day-plan";
import { settleSessionDay } from "./_utils/settle-session-day";
import { skipTestedOutBlocks } from "./_utils/skip-tested-out-blocks";
import { STUDY_SESSION_INCLUDE } from "./_utils/study-session-access";
import { readBlockPayload, toBlockPayload } from "./block-payload";
import { getStoredBlockWait } from "./block-wait";
import { getSessionUsedMinutes } from "./session-minutes";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2026-09-30T12:00:00Z");

async function setup({
  minutes = 100,
  queued = 10,
  lessons = 14,
  firstPhaseLessons = lessons,
  queuedFrom = 0,
}: {
  minutes?: number;
  queued?: number;
  lessons?: number;
  firstPhaseLessons?: number;
  queuedFrom?: number;
} = {}) {
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
    items: playable.map(({ lesson }, index) => ({
      lessonId: lesson.id,
      minutes: 10,
      phase: index < firstPhaseLessons ? 0 : 1,
    })),
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
      .slice(queuedFrom, queuedFrom + queued)
      .map(({ lesson }, position) =>
        studySessionBlockFixture({
          estimatedMinutes: 10,
          lessonId: lesson.id,
          payload: toBlockPayload({ planItemId: plan.items[queuedFrom + position]?.id }),
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

async function addCheckpoint({
  fixture,
  kind = "boss",
  estimatedMinutes = 10,
  mock = false,
  position = fixture.blocks.length,
  rematch = false,
}: {
  fixture: Awaited<ReturnType<typeof setup>>;
  kind?: "boss" | "finalBoss" | "weekly";
  estimatedMinutes?: number;
  mock?: boolean;
  position?: number;
  rematch?: boolean;
}) {
  const item =
    kind === "weekly"
      ? await planItemFixture({ kind: "checkpoint", planId: fixture.plan.id })
      : await prisma.planItem.findFirstOrThrow({
          where: { kind: "boss", phase: 0, planId: fixture.plan.id },
        });

  const block = await studySessionBlockFixture({
    estimatedMinutes,
    kind: "checkpoint",
    payload: toBlockPayload({
      checkpoint: {
        kind,
        mock,
        ...(mock && { mockIdentity: { day: null, fullLength: false } }),
        passMark: 7,
        phase: 0,
        rematch,
        timeLimitMinutes: null,
      },
      planItemId: item.id,
    }),
    position,
    sessionId: fixture.session.id,
  });

  return { block, item };
}

async function appendSavedPlan(fixture: Awaited<ReturnType<typeof setup>>) {
  const context = await loadPlanAtToken(fixture.goal.id, { now: new Date(), timeZone: "UTC" });

  if (!context) {
    throw new Error("Expected the saved plan");
  }

  const session = await prisma.studySession.findUniqueOrThrow({
    include: STUDY_SESSION_INCLUDE,
    where: { id: fixture.session.id },
  });

  return appendLandedLessons({
    goal: context.goal,
    selection: savedSelection({ context, summary: null }),
    session,
    timeZone: "UTC",
  });
}

describe("completion refits today's lessons", () => {
  it.each([false, true])(
    "fills a slow next-phase lesson's day with a due rematch: %s",
    async (rematchDue) => {
      const fixture = await setup({
        firstPhaseLessons: 2,
        lessons: 4,
        minutes: 40,
        queued: 2,
        queuedFrom: 2,
      });

      await Promise.all([
        prisma.planItem.updateMany({
          data: { completedAt: NOW, status: "done" },
          where: { kind: "lesson", phase: 0, planId: fixture.plan.id },
        }),
        prisma.planItem.updateMany({
          data: { scheduledFor: rematchDue ? fixture.session.localDate : null },
          where: { kind: "boss", phase: 0, planId: fixture.plan.id },
        }),
        prisma.lesson.update({
          data: { estimatedMinutes: 12 },
          where: { id: fixture.playable[2]?.lesson.id },
        }),
      ]);

      const checkpoint = rematchDue ? await addCheckpoint({ fixture, rematch: true }) : null;

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 30,
        sessionId: fixture.session.id,
      });

      const saved = await prisma.studySession.findUniqueOrThrow({
        include: { blocks: { orderBy: { position: "asc" } } },
        where: { id: fixture.session.id },
      });

      expect(readBlockPayload(saved.blocks[0]!).creditedMinutes).toBe(30);
      expect(getSessionUsedMinutes(saved.blocks)).toBe(40);
      expect(completion.deferredLessonsCount).toBe(rematchDue ? 1 : 0);

      expect(
        completion.blocks.some((block) => block.lessonId === fixture.playable[3]?.lesson.id),
      ).toBe(!rematchDue);

      expect(saved.blocks.filter((block) => block.kind === "checkpoint")).toMatchObject(
        rematchDue
          ? [
              {
                id: checkpoint?.block.id,
                payload: { checkpoint: { rematch: true } },
                startedAt: null,
                status: "pending",
              },
            ]
          : [],
      );

      await expect(
        prisma.planItem.findFirstOrThrow({
          where: { kind: "boss", phase: 0, planId: fixture.plan.id },
        }),
      ).resolves.toMatchObject({ status: "todo" });
    },
  );

  it("does not refill from the next phase after deferring its duel", async () => {
    const fixture = await setup({ firstPhaseLessons: 2, lessons: 4, minutes: 40, queued: 2 });

    const { block: checkpoint, item: checkpointItem } = await addCheckpoint({
      estimatedMinutes: 20,
      fixture,
    });

    await prisma.planItem.update({
      data: { scheduledFor: fixture.session.localDate },
      where: { id: checkpointItem.id },
    });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 20,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks.map((block) => block.lessonId)).toStrictEqual(
      fixture.playable.slice(0, 2).map(({ lesson }) => lesson.id),
    );

    expect(completion.blocks.map((block) => block.id)).not.toContain(checkpoint.id);
    expect(completion.deferredLessonsCount).toBe(0);

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: checkpointItem.id } }),
    ).resolves.toMatchObject({ status: "todo" });
  });

  it("does not refill from the next phase when settling a day whose duel was deferred", async () => {
    const fixture = await setup({ firstPhaseLessons: 2, lessons: 4, minutes: 40, queued: 2 });

    await Promise.all([
      prisma.planItem.updateMany({
        data: { scheduledFor: fixture.session.localDate },
        where: { kind: "boss", phase: 0, planId: fixture.plan.id },
      }),
      prisma.planItem.updateMany({
        data: { completedAt: NOW, status: "done" },
        where: { id: { in: fixture.plan.items.slice(0, 2).map((item) => item.id) } },
      }),
      prisma.studySessionBlock.updateMany({
        data: { completedAt: NOW, status: "completed" },
        where: { sessionId: fixture.session.id },
      }),
    ]);

    await expect(
      settleSessionDay({ sessionId: fixture.session.id, timeZone: "UTC", userId: fixture.user.id }),
    ).resolves.toMatchObject({ sessionCompleted: true });

    const saved = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: fixture.session.id },
    });

    expect(saved.blocks.map((block) => block.lessonId)).toStrictEqual(
      fixture.playable.slice(0, 2).map(({ lesson }) => lesson.id),
    );

    expect(saved.status).toBe("completed");
  });

  it.each([false, true])(
    "refills across a language duel only for free (plus: %s)",
    async (plus) => {
      const fixture = await setup({ firstPhaseLessons: 1, lessons: 2, minutes: 20, queued: 1 });

      await Promise.all([
        prisma.goal.update({
          data: { kind: "language", targetLanguage: "en" },
          where: { id: fixture.goal.id },
        }),
        prisma.planItem.updateMany({
          data: { scheduledFor: fixture.session.localDate },
          where: { kind: "boss", phase: 0, planId: fixture.plan.id },
        }),
      ]);

      if (plus) {
        await prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: fixture.user.id, status: "active" },
        });
      }

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 5,
        sessionId: fixture.session.id,
      });

      expect(
        completion.blocks.some((block) => block.lessonId === fixture.playable[1]?.lesson.id),
      ).toBe(!plus);

      expect(completion.sessionCompleted).toBe(plus);
    },
  );

  it.each(["boss", "finalBoss"] as const)(
    "defers a %s when a slow lesson removes its unfinished teaching",
    async (kind) => {
      const fixture = await setup({ lessons: 2, minutes: 30, queued: 2 });
      const { block: checkpoint, item: checkpointItem } = await addCheckpoint({ fixture, kind });

      expect(getStoredBlockWait({ block: checkpoint, blocks: fixture.blocks })).toBe("lessons");

      await expect(
        startStudyBlock({
          blockId: checkpoint.id,
          input: { timeZone: "UTC" },
          sessionId: fixture.session.id,
        }),
      ).resolves.toMatchObject({ reason: "lessons", status: "earlierFirst" });

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 20,
        sessionId: fixture.session.id,
      });

      expect(completion.deferredLessonsCount).toBe(0);

      expect(completion.blocks.map((block) => block.lessonId)).toContain(
        fixture.playable[1]?.lesson.id,
      );

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: fixture.plan.items[1]?.id } }),
      ).resolves.toMatchObject({ status: "todo" });

      await expect(
        startStudyBlock({
          blockId: checkpoint.id,
          input: { timeZone: "UTC" },
          sessionId: fixture.session.id,
        }),
      ).resolves.toMatchObject({ status: "notFound" });

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: checkpointItem.id } }),
      ).resolves.toMatchObject({ status: "todo" });
    },
  );

  it("does not append a deferred checkpoint while some of its teaching still does not fit", async () => {
    const fixture = await setup({ lessons: 4, minutes: 50, queued: 4 });
    await addCheckpoint({ fixture });

    await prisma.planItem.updateMany({
      data: { scheduledFor: fixture.session.localDate },
      where: { planId: fixture.plan.id },
    });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 25,
      sessionId: fixture.session.id,
    });

    expect(completion.deferredLessonsCount).toBe(1);
    const appended = await appendSavedPlan(fixture);

    expect(appended.blocks.filter((block) => block.kind === "checkpoint")).toHaveLength(0);
    expect(appended.plannedMinutes).toBe(50);

    expect(appended.blocks.map((block) => block.lessonId)).not.toContain(
      fixture.playable[3]?.lesson.id,
    );
  });

  it.each([false, true])(
    "keeps the weekly challenge independent of deferred teaching (mock: %s)",
    async (mock) => {
      const fixture = await setup({ lessons: 2, minutes: 30, queued: 2 });
      const { block: checkpoint } = await addCheckpoint({ fixture, kind: "weekly", mock });

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 20,
        sessionId: fixture.session.id,
      });

      expect(completion.deferredLessonsCount).toBe(1);
      expect(completion.blocks.map((block) => block.id)).toContain(checkpoint.id);

      await expect(
        startStudyBlock({
          blockId: checkpoint.id,
          input: { timeZone: "UTC" },
          sessionId: fixture.session.id,
        }),
      ).resolves.toMatchObject({ status: mock ? "ready" : "questionsNeeded" });
    },
  );

  it.each([1, 3])(
    "keeps a first duel at position %s when only next-phase teaching is removed",
    async (position) => {
      const fixture = await setup({ firstPhaseLessons: 1, lessons: 2, minutes: 30, queued: 2 });

      await prisma.studySessionBlock.update({
        data: { position: 2 },
        where: { id: fixture.blocks[1]?.id },
      });

      const { block: checkpoint } = await addCheckpoint({ fixture, position });

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 20,
        sessionId: fixture.session.id,
      });

      expect(completion.deferredLessonsCount).toBe(1);
      expect(completion.blocks.map((block) => block.id)).toContain(checkpoint.id);
    },
  );

  it.each(["pending", "active"] as const)("preserves a started %s checkpoint", async (status) => {
    const fixture = await setup({ lessons: 2, minutes: 30, queued: 2 });
    const { block: checkpoint } = await addCheckpoint({ fixture });

    await prisma.studySessionBlock.update({
      data: { startedAt: NOW, status },
      where: { id: checkpoint.id },
    });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 20,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks.map((block) => block.id)).toContain(checkpoint.id);
  });

  it("appends a checkpoint after its teaching when both fit", async () => {
    const fixture = await setup({ lessons: 2, minutes: 50, queued: 1 });

    await prisma.planItem.updateMany({
      data: { scheduledFor: fixture.session.localDate },
      where: { planId: fixture.plan.id },
    });

    const appended = await appendSavedPlan(fixture);
    const checkpoint = appended.blocks.find((block) => block.kind === "checkpoint");

    expect(checkpoint).toBeDefined();

    expect(appended.blocks.map((block) => block.lessonId)).toContain(
      fixture.playable[1]?.lesson.id,
    );

    expect(getStoredBlockWait({ block: checkpoint!, blocks: appended.blocks })).toBe("lessons");
  });

  it("keeps a standalone challenge whole when it is longer than the day", async () => {
    const fixture = await setup({ lessons: 2, minutes: 10, queued: 0 });

    await prisma.planItem.updateMany({
      data: { scheduledFor: fixture.session.localDate },
      where: { planId: fixture.plan.id },
    });

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { kind: "lesson", planId: fixture.plan.id },
    });

    const appended = await appendSavedPlan(fixture);
    expect(appended.blocks.map((block) => block.kind)).toStrictEqual(["checkpoint"]);
    expect(appended.plannedMinutes).toBe(15);
  });

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
