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
import { runOwedSettlements } from "./_test-utils/owed-settlements";
import { refitSessionLessons } from "./_utils/refit-session-lessons";
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

async function setupChallengeDay({
  minutes,
  challengeMinutes,
  nextPhase = false,
  rematch = false,
  final = false,
}: {
  minutes: number;
  challengeMinutes: number;
  nextPhase?: boolean;
  rematch?: boolean;
  final?: boolean;
}) {
  const fixture = await setup({ lessons: nextPhase ? 3 : 2, minutes, queued: 2 });
  await prisma.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });

  if (nextPhase) {
    await prisma.planItem.update({
      data: { phase: 1, position: 3 },
      where: { id: fixture.plan.items[2]!.id },
    });
  }

  const challenge = await planItemFixture({
    kind: "boss",
    minutes: challengeMinutes,
    phase: 0,
    planId: fixture.plan.id,
    position: 2,
  });

  const block = await studySessionBlockFixture({
    estimatedMinutes: challengeMinutes,
    kind: "checkpoint",
    payload: toBlockPayload({
      checkpoint: {
        kind: final ? "finalBoss" : "boss",
        mock: false,
        passMark: 7,
        phase: 0,
        rematch,
        timeLimitMinutes: null,
      },
      planItemId: challenge.id,
    }),
    position: 2,
    sessionId: fixture.session.id,
  });

  return { ...fixture, challenge, challengeBlock: block };
}

describe("phase challenges follow their lessons during refitting", () => {
  it("cuts the challenge first on a 30-minute day when the first lesson takes 20", async () => {
    const fixture = await setupChallengeDay({ challengeMinutes: 10, minutes: 30 });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 20,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks.map((block) => block.id)).not.toContain(fixture.challengeBlock.id);

    expect(completion.blocks.map((block) => block.lessonId)).toContain(
      fixture.playable[1]!.lesson.id,
    );

    expect(completion.deferredLessonsCount).toBe(0);
  });

  it.each([
    { final: false, rematch: false },
    { final: false, rematch: true },
    { final: true, rematch: false },
  ])(
    "fills past a trimmed challenge without locking the next phase: %j",
    async ({ rematch, final }) => {
      const fixture = await setupChallengeDay({
        challengeMinutes: 20,
        final,
        minutes: 40,
        nextPhase: true,
        rematch,
      });

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 20,
        sessionId: fixture.session.id,
      });

      expect(completion.blocks.map((block) => block.id)).not.toContain(fixture.challengeBlock.id);

      expect(completion.blocks.map((block) => block.lessonId)).toContain(
        fixture.playable[2]!.lesson.id,
      );

      expect(completion.minutes.left).toBe(20);
      expect(completion.deferredLessonsCount).toBe(0);
    },
  );

  it("counts only lessons still absent after refill", async () => {
    const fixture = await setupChallengeDay({ challengeMinutes: 20, minutes: 50, nextPhase: true });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      lessonId: fixture.playable[2]!.lesson.id,
      payload: toBlockPayload({ planItemId: fixture.plan.items[2]!.id }),
      position: 3,
      sessionId: fixture.session.id,
    });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 25,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks.map((block) => block.lessonId)).toContain(
      fixture.playable[2]!.lesson.id,
    );

    expect(completion.deferredLessonsCount).toBe(0);
    expect(completion.blocks.map((block) => block.id)).not.toContain(fixture.challengeBlock.id);
  });
});

async function addSavedChallenge(
  fixture: Awaited<ReturnType<typeof setup>>,
  {
    kind = "text",
    position = 2,
    minutes = 10,
  }: { kind?: "text" | "call"; position?: number; minutes?: number } = {},
) {
  await prisma.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });

  return planItemFixture({
    facts: {
      boss: {
        kind,
        minutes,
        questions: kind === "call" ? null : 10,
        testedKeys: [],
        testedSkillIds: [fixture.plan.items[0]!.skillId!],
        waiting: false,
      },
      minutes,
      parts: { checkpoint: minutes, practice: 0, unwritten: 0, written: 0 },
      schemaVersion: 1,
      skillIds: [],
    },
    kind: "boss",
    planId: fixture.plan.id,
    position,
  });
}

describe("completion adds a reached challenge from its saved facts", () => {
  it.each(["pending", "active"] as const)(
    "waits until an earlier extra lesson is finished before refilling its challenge (%s)",
    async (status) => {
      const fixture = await setup({ lessons: 3, minutes: 40, queued: 1 });
      await prisma.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });

      await prisma.planItem.update({
        data: { phase: 1, position: 3 },
        where: { id: fixture.plan.items[2]!.id },
      });

      const boss = await addSavedChallenge(fixture);

      await studySessionBlockFixture({
        estimatedMinutes: 10,
        kind: "practice",
        position: 1,
        sessionId: fixture.session.id,
      });

      const extra = await studySessionBlockFixture({
        estimatedMinutes: 10,
        lessonId: fixture.playable[1]!.lesson.id,
        payload: toBlockPayload({
          areaId: "extra-area",
          extra: true,
          planItemId: fixture.plan.items[1]!.id,
        }),
        position: 2,
        sessionId: fixture.session.id,
        startedAt: status === "active" ? NOW : null,
        status,
      });

      const { completion } = await finish({
        block: fixture.blocks[0]!,
        elapsedMinutes: 5,
        sessionId: fixture.session.id,
      });

      expect(completion.blocks.some((block) => block.kind === "checkpoint")).toBe(false);

      await finish({ block: extra, elapsedMinutes: 5, sessionId: fixture.session.id });

      const nextLesson = await prisma.studySessionBlock.findFirstOrThrow({
        where: { lessonId: fixture.playable[2]!.lesson.id, sessionId: fixture.session.id },
      });

      await finish({ block: nextLesson, elapsedMinutes: 5, sessionId: fixture.session.id });

      const challenge = await prisma.studySessionBlock.findFirstOrThrow({
        where: { kind: "checkpoint", sessionId: fixture.session.id },
      });

      expect(readBlockPayload(challenge).planItemId).toBe(boss.id);

      await expect(
        startStudyBlock({
          blockId: challenge.id,
          input: { timeZone: "UTC" },
          sessionId: fixture.session.id,
        }),
      ).resolves.toMatchObject({ status: "questionsNeeded" });
    },
  );

  it.each([true, false])(
    "keeps a full-review day free of challenges and new lessons during the final refill (every topic covered: %s)",
    async (covered) => {
      const fixture = await setup({ lessons: 2, minutes: 30, queued: 0 });

      await prisma.planItem.update({
        data: { minutes: 5, phase: 1, position: 3 },
        where: { id: fixture.plan.items[1]!.id },
      });

      await prisma.lesson.update({
        data: { estimatedMinutes: 5 },
        where: { id: fixture.playable[1]!.lesson.id },
      });

      await addSavedChallenge(fixture, { position: 1 });

      await prisma.goal.update({
        data: { kind: "exam", targetDate: new Date("2026-10-04") },
        where: { id: fixture.goal.id },
      });

      await prisma.planItem.update({
        data: { completedAt: NOW, status: "done" },
        where: { id: fixture.plan.items[0]!.id },
      });

      await planItemFixture({
        kind: "mock",
        planId: fixture.plan.id,
        position: 2,
        scheduledFor: fixture.session.localDate,
      });

      const reviews = await Promise.all(
        (covered ? [30] : [15, 15]).map((minutes, position) =>
          studySessionBlockFixture({
            completedAt: NOW,
            estimatedMinutes: minutes,
            kind: "practice",
            payload: toBlockPayload({ creditedMinutes: covered ? 15 : 7, fullReview: covered }),
            position,
            sessionId: fixture.session.id,
            startedAt: NOW,
            status: "completed",
          }),
        ),
      );

      const refit = await prisma.$transaction((tx) =>
        refitSessionLessons(tx, { sessionId: fixture.session.id, timeZone: "UTC" }),
      );

      expect(refit.reserved).toBe(false);

      await expect(
        prisma.studySessionBlock.findMany({
          orderBy: { position: "asc" },
          where: { sessionId: fixture.session.id },
        }),
      ).resolves.toMatchObject(reviews.map((review) => ({ id: review.id, status: "completed" })));
    },
  );

  it("keeps a planned review day free of phase challenges during refill", async () => {
    const fixture = await setup({ lessons: 2, minutes: 30, queued: 2 });
    await addSavedChallenge(fixture);

    await planItemFixture({
      kind: "review",
      planId: fixture.plan.id,
      position: 3,
      scheduledFor: fixture.session.localDate,
    });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 5,
      sessionId: fixture.session.id,
    });

    expect(completion.blocks.some((block) => block.kind === "checkpoint")).toBe(false);
  });

  it("places a new challenge after its started lesson when both need new positions", async () => {
    const fixture = await setup({ lessons: 4, minutes: 45, queued: 3 });
    await prisma.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });

    await prisma.planItem.update({
      data: { phase: 1, position: 4 },
      where: { id: fixture.plan.items[3]!.id },
    });

    const boss = await addSavedChallenge(fixture, { position: 3 });

    await prisma.studySessionBlock.update({
      data: { position: 3, startedAt: NOW, status: "active" },
      where: { id: fixture.blocks[2]!.id },
    });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      kind: "practice",
      position: 2,
      sessionId: fixture.session.id,
    });

    await finish({ block: fixture.blocks[0]!, elapsedMinutes: 5, sessionId: fixture.session.id });

    const blocks = await prisma.studySessionBlock.findMany({
      where: { sessionId: fixture.session.id },
    });

    const challenge = blocks.find((block) => readBlockPayload(block).planItemId === boss.id)!;
    const started = blocks.find((block) => block.id === fixture.blocks[2]!.id)!;
    expect(started).toMatchObject({ startedAt: NOW, status: "active" });
    expect(started.position).toBeLessThan(challenge.position);

    await expect(
      startStudyBlock({
        blockId: challenge.id,
        input: { timeZone: "UTC" },
        sessionId: fixture.session.id,
      }),
    ).resolves.toMatchObject({ reason: "lessons", status: "earlierFirst" });
  });

  it("holds a refilled challenge for its own lesson the learner already opened", async () => {
    const fixture = await setup({ lessons: 4, minutes: 45, queued: 2 });

    await prisma.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });

    await prisma.planItem.update({
      data: { phase: 1, position: 4 },
      where: { id: fixture.plan.items[3]!.id },
    });

    const boss = await addSavedChallenge(fixture, { position: 3 });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      kind: "practice",
      position: 2,
      sessionId: fixture.session.id,
    });

    await finish({ block: fixture.blocks[0]!, elapsedMinutes: 10, sessionId: fixture.session.id });

    const appended = await prisma.studySessionBlock.findFirstOrThrow({
      where: { lessonId: fixture.playable[2]!.lesson.id, sessionId: fixture.session.id },
    });

    const practice = await prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "practice", sessionId: fixture.session.id },
    });

    expect(appended.position).toBeLessThan(practice.position);

    await startStudyBlock({
      blockId: appended.id,
      input: { timeZone: "UTC" },
      sessionId: fixture.session.id,
    });

    await finish({ block: fixture.blocks[1]!, elapsedMinutes: 5, sessionId: fixture.session.id });

    const blocks = await prisma.studySessionBlock.findMany({
      where: { sessionId: fixture.session.id },
    });

    const challenge = blocks.find((block) => readBlockPayload(block).planItemId === boss.id)!;

    await expect(
      startStudyBlock({
        blockId: challenge.id,
        input: { timeZone: "UTC" },
        sessionId: fixture.session.id,
      }),
    ).resolves.toMatchObject({ reason: "lessons", status: "earlierFirst" });
  });

  it.each([false, true])("refills a language call only with Plus (Plus: %s)", async (plus) => {
    const fixture = await setup({ lessons: 2, minutes: 30, queued: 2 });

    await prisma.goal.update({
      data: { kind: "language", targetLanguage: "en" },
      where: { id: fixture.goal.id },
    });

    if (plus) {
      await prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: fixture.user.id, status: "active" },
      });
    }

    await addSavedChallenge(fixture, { kind: "call" });

    const { completion } = await finish({
      block: fixture.blocks[0]!,
      elapsedMinutes: 5,
      sessionId: fixture.session.id,
    });

    expect(
      completion.blocks.some((block) => block.checkpoint !== null && block.kind === "checkpoint"),
    ).toBe(plus);
  });

  it("inserts a newly fitting challenge before pending next-phase lessons and practice", async () => {
    const fixture = await setup({ lessons: 4, minutes: 50, queued: 4 });
    await prisma.planItem.deleteMany({ where: { kind: "boss", planId: fixture.plan.id } });

    await prisma.planItem.update({
      data: { phase: 1, position: 4 },
      where: { id: fixture.plan.items[3]!.id },
    });

    const boss = await addSavedChallenge(fixture, { minutes: 15, position: 3 });

    await studySessionBlockFixture({
      estimatedMinutes: 10,
      kind: "practice",
      position: 4,
      sessionId: fixture.session.id,
    });

    for (const index of [0, 1, 2]) {
      // oxlint-disable-next-line no-await-in-loop -- each completion frees the time the next queue refit sees
      await finish({
        block: fixture.blocks[index]!,
        elapsedMinutes: 5,
        sessionId: fixture.session.id,
      });
    }

    const blocks = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: fixture.session.id },
    });

    const challengeAt = blocks.findIndex((block) => readBlockPayload(block).planItemId === boss.id);
    expect(challengeAt).toBeGreaterThanOrEqual(0);

    expect(challengeAt).toBeLessThan(
      blocks.findIndex((block) => block.lessonId === fixture.playable[3]!.lesson.id),
    );

    expect(challengeAt).toBeLessThan(blocks.findIndex((block) => block.kind === "practice"));
  });
});

describe("a challenge put off for the day's lessons", () => {
  it.each([true, false])(
    "stays after them when a completion refills the day (built into the day: %s)",
    async (inDay) => {
      const fixture = await setup({ lessons: 5, minutes: 40, queued: 0 });
      const [done, ...rest] = fixture.plan.items;

      await prisma.planItem.update({ data: { status: "done" }, where: { id: done!.id } });

      await prisma.planItem.updateMany({
        data: { position: { increment: 10 } },
        where: { id: { in: rest.map((item) => item.id) } },
      });

      const boss = await addSavedChallenge(fixture, { minutes: 5, position: 1 });

      const lessons = await Promise.all(
        (inDay ? [1, 2, 3] : [1, 2, 3, 4]).map((index, position) =>
          studySessionBlockFixture({
            estimatedMinutes: 10,
            lessonId: fixture.playable[index]!.lesson.id,
            payload: toBlockPayload({ planItemId: fixture.plan.items[index]!.id }),
            position,
            sessionId: fixture.session.id,
          }),
        ),
      );

      if (inDay) {
        await studySessionBlockFixture({
          estimatedMinutes: 5,
          kind: "checkpoint",
          payload: toBlockPayload({
            afterLessons: true,
            checkpoint: {
              kind: "boss",
              mock: false,
              passMark: 7,
              phase: 0,
              rematch: false,
              timeLimitMinutes: null,
            },
            planItemId: boss.id,
          }),
          position: 3,
          sessionId: fixture.session.id,
        });
      }

      await finish({ block: lessons[0]!, elapsedMinutes: 5, sessionId: fixture.session.id });

      const pending = await prisma.studySessionBlock.findMany({
        orderBy: { position: "asc" },
        where: { sessionId: fixture.session.id, status: "pending" },
      });

      expect(pending.map((block) => readBlockPayload(block).planItemId)).toStrictEqual([
        ...[2, 3, 4].map((index) => fixture.plan.items[index]!.id),
        boss.id,
      ]);
    },
  );
});

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
