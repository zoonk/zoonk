import { type TransactionClient, prisma } from "@zoonk/db";
import { expect, vi } from "vitest";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";

export const LEARNER_LOCK = /FROM users WHERE id = \S+::uuid FOR NO KEY UPDATE/u;

/** PostgreSQL can briefly report a blocked waiter's previous statement, so keep polling. */
export async function waitForBlockedStatement(
  holderPID: number,
  statement: RegExp,
  count = 1,
): Promise<void> {
  await vi.waitFor(
    async () => {
      // A second contender for the same row waits behind the first one, not the holder itself.
      const blocked = await prisma.$queryRaw<{ query: string }[]>`
      WITH RECURSIVE waiting(pid) AS (
        SELECT pid FROM pg_stat_activity WHERE ${holderPID}::int = ANY(pg_blocking_pids(pid))
        UNION
        SELECT activity.pid FROM pg_stat_activity AS activity
        JOIN waiting ON waiting.pid = ANY(pg_blocking_pids(activity.pid))
      )
      SELECT query FROM pg_stat_activity WHERE pid IN (SELECT pid FROM waiting)
    `;

      expect(blocked.filter(({ query }) => statement.test(query)).length).toBeGreaterThanOrEqual(
        count,
      );
    },
    { timeout: 10_000 },
  );
}

export function holdLearnerLock({
  beforeCommit,
  userId,
}: {
  beforeCommit?: (tx: TransactionClient) => Promise<unknown>;
  userId: string;
}) {
  const held = Promise.withResolvers<number>();
  const released = Promise.withResolvers<null>();

  const done = prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    held.resolve(backend?.pid ?? 0);
    await released.promise;
    await beforeCommit?.(tx);
  });

  done.catch((error: unknown) => held.reject(error));

  return { done, pid: held.promise, release: () => released.resolve(null) };
}
