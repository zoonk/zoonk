import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { persistLearnerAnswer } from "../learner/record-learner-answer";
import { answerStudyQuestion } from "./answer-study-question";
import { readBlockPayload, toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

/** Keep foreign queues traversable, but count only this worker's active test connections. */
function readOwnWaiters(holderPid: number) {
  return prisma.$queryRaw<{ pid: number }[]>`
    WITH RECURSIVE waiting AS (
      SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
      UNION
      SELECT activity.pid FROM pg_stat_activity activity JOIN waiting
        ON waiting.pid = ANY(pg_blocking_pids(activity.pid))
      WHERE activity.datname = current_database()
    )
    SELECT activity.pid FROM pg_stat_activity activity JOIN waiting USING (pid)
    WHERE activity.application_name = current_setting('application_name')
      AND activity.application_name <> ''`;
}

async function setup(kind: "checkpoint" | "practice" = "checkpoint") {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const session = await studySessionFixture({
    startedAt: new Date(),
    status: "active",
    userId: user.id,
  });

  const block = await studySessionBlockFixture({
    kind,
    payload: toBlockPayload({
      checkpoint:
        kind === "checkpoint"
          ? {
              kind: "boss",
              mock: false,
              passMark: 1,
              phase: 0,
              rematch: false,
              timeLimitMinutes: null,
            }
          : null,
      itemIds: [item.id],
    }),
    sessionId: session.id,
    startedAt: new Date(),
    status: "active",
  });

  mockSession(user.id);

  const submit = (selectedIndex: number) =>
    answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex }, durationMs: 1000, itemId: item.id },
      sessionId: session.id,
    });

  return { block, item, session, skill, submit, user };
}

describe("checkpoint answer recording", () => {
  it("rolls back the checkpoint attempt, memory, and notebook together when recording aborts", async () => {
    const { item, session, skill, user } = await setup();

    await expect(
      prisma.$transaction(async (transaction) => {
        await persistLearnerAnswer({
          input: {
            answer: { selectedIndex: 1 },
            graded: { durationMs: 1000, isCorrect: false },
            itemId: item.id,
            language: "en",
            mistake: {
              questionText: "Which rule applies?",
              snapshot: { answer: "Wrong answer", question: "Which rule applies?" },
            },
            purpose: "learning",
            skillId: skill.id,
            studySessionId: session.id,
            timeZone: "UTC",
            userId: user.id,
          },
          transaction,
        });

        throw new Error("Abort checkpoint recording");
      }),
    ).rejects.toThrow("Abort checkpoint recording");

    const counts = await Promise.all([
      prisma.attempt.count({ where: { userId: user.id } }),
      prisma.learnerSkill.count({ where: { userId: user.id } }),
      prisma.mistake.count({ where: { userId: user.id } }),
    ]);

    expect(counts).toStrictEqual([0, 0, 0]);
  });

  it("does not acknowledge a replay until the first answer's memory review commits", async () => {
    const { block, session, skill, submit, user } = await setup();

    const memory = await learnerSkillFixture({
      difficulty: 5,
      lastReviewedAt: new Date(Date.now() - 86_400_000),
      recallDays: 2,
      reps: 2,
      skillId: skill.id,
      stability: 8,
      state: "solid",
      userId: user.id,
    });

    await prisma.studySession.update({
      data: {
        startSnapshot: {
          brainPower: 0,
          energy: 100,
          preparation: null,
          progress: null,
          skillStates: { [skill.id]: "solid" },
        },
      },
      where: { id: session.id },
    });

    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const holding = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM learner_skills WHERE id = ${memory.id}::uuid FOR UPDATE`;
        const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        ready.resolve(connection?.pid ?? 0);
        await release.promise;
      },
      { timeout: 12_000 },
    );

    const held = Promise.allSettled([holding]);
    void holding.catch(ready.reject);
    const holderPid = await ready.promise;
    const first = Promise.allSettled([submit(0)]);
    const replay = Promise.withResolvers<Awaited<ReturnType<typeof submit>>>();

    try {
      await expect
        .poll(
          async () => prisma.$queryRaw<{ pid: number }[]>`
        SELECT pid FROM pg_stat_activity
        WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
          AND application_name = current_setting('application_name') AND application_name <> ''
      `,
          { interval: 10, timeout: 4000 },
        )
        .toHaveLength(1);

      void submit(1).then(replay.resolve, replay.reject);

      await expect
        .poll(() => readOwnWaiters(holderPid), { interval: 10, timeout: 4000 })
        .toHaveLength(2);

      await expect(
        prisma.attempt.count({ where: { studySessionId: session.id, userId: user.id } }),
      ).resolves.toBe(0);
    } finally {
      release.resolve(null);
      await held;
      await first;
    }

    await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);

    await expect(first).resolves.toMatchObject([
      { status: "fulfilled", value: { status: "ready" } },
    ]);

    await expect(replay.promise).resolves.toMatchObject({
      feedback: { isCorrect: true },
      status: "ready",
    });

    await expect(
      prisma.attempt.count({ where: { studySessionId: session.id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({ where: { id: memory.id } }),
    ).resolves.toMatchObject({ recallDays: 3, reps: 3, state: "mastered" });

    await expect(
      finishStudyBlock({ blockId: block.id, input: {}, sessionId: session.id }),
    ).resolves.toMatchObject({
      completion: { checkpoint: { answers: [{ isCorrect: true }], correct: 1, total: 1 } },
      status: "ready",
    });

    const completed = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(completed.startSnapshot).toMatchObject({ masteryRewards: { [skill.id]: "mastered" } });
  });

  it("classifies a checkpoint mistake from the answers before the committed attempt", async () => {
    const { item, skill, submit, user } = await setup();

    await learnerSkillFixture({ reps: 5, skillId: skill.id, state: "learning", userId: user.id });

    await Promise.all(
      [true, true, true, true, false].map((isCorrect, index) =>
        attemptFixture({
          answeredAt: new Date(Date.now() - (index + 1) * 60_000),
          isCorrect,
          itemId: item.id,
          skillId: skill.id,
          userId: user.id,
        }),
      ),
    );

    await expect(submit(1)).resolves.toMatchObject({
      feedback: { isCorrect: false },
      status: "ready",
    });

    const mistake = await prisma.mistake.findFirstOrThrow({
      where: { itemId: item.id, userId: user.id },
    });

    expect(mistake.cause).toBe("trap");
  });

  it.each([
    { kind: "checkpoint", overlappingBlocks: false },
    { kind: "checkpoint", overlappingBlocks: true },
    { kind: "practice", overlappingBlocks: false },
  ] as const)(
    "records parallel submissions once: $kind, overlapping blocks: $overlappingBlocks",
    async ({ kind, overlappingBlocks }) => {
      const { block, item, session, skill, submit, user } = await setup(kind);

      const otherBlock = overlappingBlocks
        ? await studySessionBlockFixture({
            kind: "checkpoint",
            payload: readBlockPayload(block),
            sessionId: session.id,
            startedAt: new Date(),
            status: "active",
          })
        : block;

      const ready = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();
      /** The item FK holds both old inserts, or one new insert and its block-lock waiter. */
      const holding = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM items WHERE id = ${item.id}::uuid FOR UPDATE`;

          const [connection] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve(connection?.pid ?? 0);
          await release.promise;
        },
        { timeout: 12_000 },
      );

      const held = Promise.allSettled([holding]);
      void holding.catch(ready.reject);
      const holderPid = await ready.promise;
      // More foreign waiters than the expected two prevents an unscoped poll passing early.
      const foreignName = `checkpoint-foreign:${item.id}`;

      const foreign = Promise.allSettled(
        Array.from({ length: 3 }, () =>
          prisma.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT set_config('application_name', ${foreignName}, true)`;
              await tx.$queryRaw`SELECT id FROM items WHERE id = ${item.id}::uuid FOR KEY SHARE`;
            },
            { timeout: 12_000 },
          ),
        ),
      );

      const startSubmissions = Promise.withResolvers<null>();

      const submissions = Promise.allSettled([
        startSubmissions.promise.then(() => submit(0)),
        startSubmissions.promise.then(() =>
          answerStudyQuestion({
            blockId: otherBlock.id,
            input: { answer: { selectedIndex: 1 }, durationMs: 1000, itemId: item.id },
            sessionId: session.id,
          }),
        ),
      ]);

      try {
        await expect
          .poll(
            async () => prisma.$queryRaw<{ pid: number }[]>`
              SELECT pid FROM pg_stat_activity
              WHERE datname = current_database() AND application_name = ${foreignName}
                AND ${holderPid} = ANY(pg_blocking_pids(pid))
            `,
            { interval: 10, timeout: 4000 },
          )
          .toHaveLength(3);

        startSubmissions.resolve(null);

        await expect
          .poll(() => readOwnWaiters(holderPid), { interval: 10, timeout: 4000 })
          .toHaveLength(2);
      } finally {
        startSubmissions.resolve(null);
        release.resolve(null);
        await held;
        await submissions;
        await foreign;
      }

      await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);

      await expect(foreign).resolves.toMatchObject([
        { status: "fulfilled" },
        { status: "fulfilled" },
        { status: "fulfilled" },
      ]);

      const attempts = await prisma.attempt.findMany({
        where: { itemId: item.id, studySessionId: session.id, userId: user.id },
      });

      expect(attempts).toHaveLength(1);

      const answered = { feedback: { isCorrect: attempts[0]?.isCorrect }, status: "ready" };

      const settled = await submissions;

      const outcomes = settled
        .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
        .toSorted((first, second) => first.status.localeCompare(second.status));

      // A checkpoint acknowledges the later submission with the stored verdict; any other block
      // says it was answered already, whichever tab got there first.
      expect(outcomes).toMatchObject(
        kind === "checkpoint" ? [answered, answered] : [{ status: "alreadyAnswered" }, answered],
      );

      const memory = await prisma.learnerSkill.findUniqueOrThrow({
        where: { userSkill: { skillId: skill.id, userId: user.id } },
      });

      expect(memory.reps).toBe(1);
    },
  );

  it("returns an existing checkpoint answer on a later retry, without another memory review", async () => {
    const { block, session, submit, user } = await setup();

    await expect(submit(1)).resolves.toMatchObject({
      feedback: { isCorrect: false },
      status: "ready",
    });

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: block.id },
    });

    await expect(submit(0)).resolves.toMatchObject({
      feedback: { isCorrect: false },
      status: "ready",
    });

    await expect(
      prisma.attempt.count({ where: { studySessionId: session.id, userId: user.id } }),
    ).resolves.toBe(1);

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it.each(["completed", "deleted", "replaced"] as const)(
    "rechecks a checkpoint that was %s while the answer waited for its block lock",
    async (change) => {
      const { block, session, submit, user } = await setup();
      const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const ready = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const holding = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${block.id}::uuid FOR UPDATE`;

          const [connection] = await tx.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;

          ready.resolve(connection?.pid ?? 0);
          await release.promise;

          if (change === "deleted") {
            await tx.studySessionBlock.delete({ where: { id: block.id } });
            return;
          }

          await tx.studySessionBlock.update({
            data:
              change === "completed"
                ? { completedAt: new Date(), status: "completed" }
                : { payload: toBlockPayload({ itemIds: [] }) },
            where: { id: block.id },
          });
        },
        { timeout: 12_000 },
      );

      const held = Promise.allSettled([holding]);
      void holding.catch(ready.reject);
      const holderPid = await ready.promise;
      const answering = Promise.allSettled([submit(0)]);

      try {
        await expect
          .poll(
            async () => prisma.$queryRaw<{ pid: number }[]>`
          SELECT pid FROM pg_stat_activity
          WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
            AND application_name = current_setting('application_name') AND application_name <> ''
            AND query ~* 'study_session_blocks'
        `,
            { interval: 10, timeout: 4000 },
          )
          .toHaveLength(1);
      } finally {
        release.resolve(null);
        await held;
        await answering;
      }

      await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);

      const status = { completed: "blockNotActive", deleted: "notFound", replaced: "invalidItem" }[
        change
      ];

      await expect(answering).resolves.toMatchObject([{ status: "fulfilled", value: { status } }]);

      await expect(
        prisma.attempt.count({ where: { studySessionId: session.id, userId: user.id } }),
      ).resolves.toBe(0);

      await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);

      await expect(
        prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).resolves.toMatchObject({ learnerRevision: before.learnerRevision });
    },
  );

  it("still records the same practice item again in a later session", async () => {
    const { block, item, submit, user } = await setup("practice");
    await expect(submit(1)).resolves.toMatchObject({ status: "ready" });

    const retrySession = await studySessionFixture({
      localDate: new Date("2030-01-02"),
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    const retryBlock = await studySessionBlockFixture({
      kind: "practice",
      payload: readBlockPayload(block),
      sessionId: retrySession.id,
      startedAt: new Date(),
      status: "active",
    });

    await expect(
      answerStudyQuestion({
        blockId: retryBlock.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: item.id },
        sessionId: retrySession.id,
      }),
    ).resolves.toMatchObject({ feedback: { isCorrect: true }, status: "ready" });

    const attempts = await prisma.attempt.findMany({
      orderBy: { answeredAt: "asc" },
      where: { itemId: item.id, userId: user.id },
    });

    expect(attempts.map((attempt) => attempt.isCorrect)).toStrictEqual([false, true]);
  });
});
