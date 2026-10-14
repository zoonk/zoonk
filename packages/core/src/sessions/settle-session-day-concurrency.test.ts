import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { settleSessionDay } from "./_utils/settle-session-day";

describe("Completion follows the current session queue", () => {
  it("does not close a day whose queue gained work while completion waited", async () => {
    const user = await userFixture();

    const session = await studySessionFixture({
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    await studySessionBlockFixture({
      completedAt: new Date(),
      sessionId: session.id,
      status: "completed",
    });

    const ready = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const holding = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
      SELECT id FROM study_sessions WHERE id = ${session.id}::uuid FOR NO KEY UPDATE
    `;

        const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        ready.resolve(connection?.pid ?? 0);
        await release.promise;

        await tx.studySessionBlock.create({
          data: { kind: "learn", position: 1, sessionId: session.id },
        });
      },
      { timeout: 12_000 },
    );

    const held = Promise.allSettled([holding]);
    void holding.catch(ready.reject);
    const holderPid = await ready.promise;

    const finishing = Promise.allSettled([
      settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id }),
    ]);

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

    await expect(finishing).resolves.toMatchObject([
      { status: "fulfilled", value: { sessionCompleted: false } },
    ]);

    const current = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });
    expect(current).toMatchObject({ endedAt: null, status: "active" });

    const actor = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(actor.learnerRevision).toBe(user.learnerRevision);
  });
});
