import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../../_test-utils/frozen-clock";
import { getBlockElapsedMs } from "../../../sessions/_utils/block-timing";
import { readBlockPayload } from "../../../sessions/block-payload";
import { settleConversation } from "./settle-conversation";

/** The review run that claimed each test's call: only it settles the call. */
const REVIEW_RUN_ID = "wrun_settlement";

async function settlementFixture() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  const [oldItem, currentItem, session, currentSession] = await Promise.all([
    planItemFixture({ kind: "boss", planId: plan.id, position: 1 }),
    planItemFixture({ kind: "boss", planId: plan.id, position: 2 }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    studySessionFixture({ goalId: goal.id, localDate: new Date("2026-01-01"), userId: user.id }),
    prisma.userProgress.create({ data: { userId: user.id } }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "checkpoint",
    payload: { planItemId: oldItem.id },
    sessionId: session.id,
  });

  const row = await prisma.languageConversation.create({
    data: {
      goalId: goal.id,
      kind: "checkpoint",
      language: "en",
      level: "A2",
      minutes: 1,
      reviewRunId: REVIEW_RUN_ID,
      scenario: {},
      studyBlockId: block.id,
      targetLanguage: "es",
      titleSnapshot: "A checkpoint call",
      userId: user.id,
    },
    include: { chapter: { select: { id: true, title: true } } },
  });

  return { block, currentItem, currentSession, oldItem, row, user };
}

describe("conversation settlement during queue changes", () => {
  it("freezes a running call's focused clock while never recording more than it spoke", async () => {
    freezeClock();
    const { block, row, user } = await settlementFixture();
    const now = new Date();

    await prisma.studySessionBlock.update({
      data: {
        payload: {
          ...readBlockPayload(block),
          timing: { activeAt: new Date(now.getTime() - 20_000).toISOString(), elapsedMs: 0 },
        },
        startedAt: new Date(now.getTime() - 20_000),
        status: "active",
      },
      where: { id: block.id },
    });

    await settleConversation({
      bossKind: "boss",
      feedback: null,
      objectives: 1,
      objectivesMet: ["Completed the goal"],
      reviewRunId: REVIEW_RUN_ID,
      row,
      spokenSeconds: 5,
      timeZone: "UTC",
      usedHelp: false,
      userId: user.id,
    });

    const [event, finished] = await Promise.all([
      prisma.learningEvent.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ]);

    expect(event.seconds).toBe(5);
    expect(readBlockPayload(finished).timing).toMatchObject({ activeAt: null, elapsedMs: 20_000 });

    expect(getBlockElapsedMs({ block: finished, now: new Date(now.getTime() + 300_000) })).toBe(
      20_000,
    );
  });

  it("records only focused speech for a paused linked call while keeping its actual spoken time", async () => {
    freezeClock();
    const { block, row, user } = await settlementFixture();
    const now = new Date();
    const focusedMs = 12_999;

    await prisma.studySessionBlock.update({
      data: {
        payload: { ...readBlockPayload(block), timing: { activeAt: null, elapsedMs: focusedMs } },
        startedAt: new Date(now.getTime() - 45_000),
        status: "active",
      },
      where: { id: block.id },
    });

    const other = await studySessionBlockFixture({
      kind: "practice",
      payload: {
        timing: { activeAt: new Date(now.getTime() - 20_000).toISOString(), elapsedMs: 0 },
      },
      sessionId: block.sessionId,
      startedAt: new Date(now.getTime() - 20_000),
      status: "active",
    });

    await expect(
      settleConversation({
        bossKind: "boss",
        feedback: null,
        objectives: 1,
        objectivesMet: ["Completed the goal"],
        reviewRunId: REVIEW_RUN_ID,
        row,
        spokenSeconds: 20,
        timeZone: "UTC",
        usedHelp: false,
        userId: user.id,
      }),
    ).resolves.not.toBeNull();

    const [event, daily, savedCall, finished, unchanged] = await Promise.all([
      prisma.learningEvent.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
      prisma.languageConversation.findUniqueOrThrow({ where: { id: row.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } }),
    ]);

    expect(event.seconds).toBe(12);
    expect(daily.timeSpentSeconds).toBe(12);
    expect(savedCall.spokenSeconds).toBe(20);
    expect(finished.status).toBe("completed");

    expect(readBlockPayload(finished).timing).toMatchObject({
      activeAt: null,
      elapsedMs: focusedMs,
    });

    expect(unchanged).toStrictEqual(other);
  });

  it.each(["replace", "delete"] as const)(
    "reads the linked block after waiting for progress when the queue change is %s",
    async (change) => {
      const { block, currentItem, currentSession, oldItem, row, user } = await settlementFixture();
      const locked = Promise.withResolvers<number>();
      const release = Promise.withResolvers<null>();

      const holder = prisma.$transaction(async (tx) => {
        const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;

        await tx.$queryRaw`
          SELECT id FROM user_progress WHERE user_id = ${user.id}::uuid FOR UPDATE
        `;

        locked.resolve(connection!.pid);
        await release.promise;
      });

      const pid = await locked.promise;

      const settlement = settleConversation({
        bossKind: "boss",
        feedback: null,
        objectives: 1,
        objectivesMet: ["Completed the goal"],
        reviewRunId: REVIEW_RUN_ID,
        row,
        spokenSeconds: 20,
        timeZone: "UTC",
        usedHelp: false,
        userId: user.id,
      });

      try {
        await vi.waitFor(
          async () => {
            const waiting = await prisma.$queryRaw<{ pid: number }[]>`
              SELECT pid FROM pg_stat_activity
              WHERE datname = current_database() AND ${pid} = ANY(pg_blocking_pids(pid))
            `;

            expect(waiting.length).toBeGreaterThan(0);
          },
          { interval: 10, timeout: 4000 },
        );

        if (change === "delete") {
          await prisma.studySessionBlock.delete({ where: { id: block.id } });
        } else {
          await prisma.studySessionBlock.update({
            data: { payload: { planItemId: currentItem.id }, sessionId: currentSession.id },
            where: { id: block.id },
          });
        }
      } finally {
        release.resolve(null);
        await holder;
      }

      await expect(settlement).resolves.not.toBeNull();

      const [event, savedOldItem, savedCurrentItem] = await Promise.all([
        prisma.learningEvent.findFirstOrThrow({ where: { userId: user.id } }),
        prisma.planItem.findUniqueOrThrow({ where: { id: oldItem.id } }),
        prisma.planItem.findUniqueOrThrow({ where: { id: currentItem.id } }),
      ]);

      expect(savedOldItem.status).toBe("todo");
      expect(savedCurrentItem.status).toBe(change === "delete" ? "todo" : "done");

      expect(event.contentIds).toStrictEqual(
        change === "delete"
          ? { conversationId: row.id }
          : {
              conversationId: row.id,
              planItemId: currentItem.id,
              studySessionBlockId: block.id,
              studySessionId: currentSession.id,
            },
      );
    },
  );
});
