import { type TransactionClient, prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { settleSessionDay } from "./_utils/settle-session-day";

const MS_PER_MINUTE = 60_000;

async function finishedDay(finishedAt: Date) {
  const user = await userFixture();

  const session = await studySessionFixture({
    // Pre-save missions so these tests isolate completion from first-time mission persistence.
    missions: { picks: [], version: 1 },
    startedAt: new Date(finishedAt.getTime() - MS_PER_MINUTE),
    status: "active",
    userId: user.id,
  });

  await studySessionBlockFixture({
    completedAt: finishedAt,
    sessionId: session.id,
    status: "completed",
  });

  return { session, user };
}

/** Commits `whileHeld` only after completion has read the session and is waiting at its lock. */
async function completeWhileHeld({
  sessionId,
  userId,
  whileHeld,
}: {
  sessionId: string;
  userId: string;
  whileHeld: (tx: TransactionClient) => Promise<unknown>;
}) {
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const holding = prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`
      SELECT id FROM study_sessions WHERE id = ${sessionId}::uuid FOR NO KEY UPDATE
    `;

      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      ready.resolve(connection?.pid ?? 0);
      await release.promise;
      await whileHeld(tx);
    },
    { timeout: 12_000 },
  );

  const held = Promise.allSettled([holding]);
  void holding.catch(ready.reject);
  const holderPid = await ready.promise;

  const finishing = Promise.allSettled([settleSessionDay({ sessionId, timeZone: "UTC", userId })]);

  try {
    await expect
      .poll(
        async () => prisma.$queryRaw<{ pid: number }[]>`
      SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND ${holderPid} = ANY(pg_blocking_pids(pid))
        AND query ~* 'study_sessions'
    `,
        { interval: 10, timeout: 4000 },
      )
      .not.toHaveLength(0);
  } finally {
    release.resolve(null);
    await held;
    await finishing;
  }

  await expect(held).resolves.toMatchObject([{ status: "fulfilled" }]);
  return finishing;
}

describe("Completion follows the current session queue", () => {
  it("does not close a day whose queue gained work while completion waited", async () => {
    const { session, user } = await finishedDay(new Date());

    const finishing = await completeWhileHeld({
      sessionId: session.id,
      userId: user.id,
      whileHeld: (tx) =>
        tx.studySessionBlock.create({
          data: { kind: "learn", position: 1, sessionId: session.id },
        }),
    });

    expect(finishing).toMatchObject([{ status: "fulfilled", value: { sessionCompleted: false } }]);

    const current = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(current).toMatchObject({ endedAt: null, status: "active" });
  });

  it("ends the day with a block finished while completion waited", async () => {
    const lastFinish = new Date();

    const { session, user } = await finishedDay(
      new Date(lastFinish.getTime() - 10 * MS_PER_MINUTE),
    );

    const finishing = await completeWhileHeld({
      sessionId: session.id,
      userId: user.id,
      whileHeld: (tx) =>
        tx.studySessionBlock.create({
          data: {
            completedAt: lastFinish,
            kind: "practice",
            position: 1,
            sessionId: session.id,
            status: "completed",
          },
        }),
    });

    expect(finishing).toMatchObject([{ status: "fulfilled", value: { sessionCompleted: true } }]);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ endedAt: lastFinish, status: "completed" });
  });
});
