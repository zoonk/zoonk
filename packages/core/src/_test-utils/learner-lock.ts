import { setTimeout } from "node:timers/promises";
import { type TransactionClient, prisma } from "@zoonk/db";
import { markLearnerChanged } from "../learner/_utils/mark-learner-changed";

export const LEARNER_LOCK = /FROM users WHERE id = \S+::uuid FOR NO KEY UPDATE/u;

const LOCK_WAIT_MS = 10_000;
const POLL_INTERVAL_MS = 50;

async function countBlockedStatements(holderPID: number, statement: RegExp): Promise<number> {
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

  return blocked.filter(({ query }) => statement.test(query)).length;
}

/**
 * PostgreSQL can briefly report a blocked waiter's previous statement, so keep polling. Not with
 * `vi.waitFor` or `expect.poll`: they advance fake timers between checks, which moves a frozen clock
 * (https://vitest.dev/guide/mocking/timers#automatic-advancing).
 */
export async function waitForBlockedStatement(
  holderPID: number,
  statement: RegExp,
  count = 1,
): Promise<void> {
  const deadline = performance.now() + LOCK_WAIT_MS;

  // oxlint-disable-next-line no-await-in-loop -- Each check reads the waiters as they are now.
  while ((await countBlockedStatements(holderPID, statement)) < count) {
    if (performance.now() > deadline) {
      throw new Error(
        `Fewer than ${count} ${statement} statements waited on backend ${holderPID}.`,
      );
    }

    // oxlint-disable-next-line no-await-in-loop -- Polls until the waiters reach the lock.
    await setTimeout(POLL_INTERVAL_MS);
  }
}

function holdLock({
  beforeCommit,
  lock,
}: {
  beforeCommit?: (tx: TransactionClient) => Promise<unknown>;
  lock: (tx: TransactionClient) => Promise<unknown>;
}) {
  const held = Promise.withResolvers<number>();
  const released = Promise.withResolvers<null>();

  const done = prisma.$transaction(async (tx) => {
    await lock(tx);
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    held.resolve(backend?.pid ?? 0);
    await released.promise;
    await beforeCommit?.(tx);
  });

  done.catch((error: unknown) => held.reject(error));

  return { done, pid: held.promise, release: () => released.resolve(null) };
}

export function holdLearnerLock({
  beforeCommit,
  userId,
}: {
  beforeCommit?: (tx: TransactionClient) => Promise<unknown>;
  userId: string;
}) {
  return holdLock({ beforeCommit, lock: (tx) => markLearnerChanged(tx, { userId }) });
}

export function holdPlanLock({
  beforeCommit,
  planId,
}: {
  beforeCommit?: (tx: TransactionClient) => Promise<unknown>;
  planId: string;
}) {
  return holdLock({
    beforeCommit,
    lock: (tx) => tx.$queryRaw`SELECT id FROM plans WHERE id = ${planId}::uuid FOR UPDATE`,
  });
}
