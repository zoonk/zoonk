import { type TransactionClient, prisma } from "@zoonk/db";
import { expect, vi } from "vitest";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";

/** The statement a learner write waits on while another holds the learner's lock (`lockLearner`). */
export const LEARNER_LOCK = /FROM users WHERE id = \S+::uuid FOR NO KEY UPDATE/u;

/**
 * Waits until `count` backends waiting on `holderPID` (directly or behind another waiter) run a statement that matches `statement`, so
 * a test sees where real contenders wait, never guessing when they got there. It keeps polling: a
 * waiter's reported text can still be its previous statement for a moment after it blocks.
 */
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

/**
 * Holds the learner's lock in an open transaction, as a concurrent writer that marked first does,
 * until `release`. `beforeCommit` runs after the release, still inside the transaction, to take the
 * locks that writer takes next.
 */
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
