import { type TransactionClient, prisma } from "@zoonk/db";

const WAIT_LIMIT_MS = 4000;

export async function waitForBlocked({
  blocker,
  count,
  deadline = Date.now() + WAIT_LIMIT_MS,
}: {
  blocker: number;
  count: number;
  deadline?: number;
}): Promise<void> {
  const rows = await prisma.$queryRaw<{ waiting: bigint }[]>`
    WITH RECURSIVE blocked(pid) AS (
      SELECT pid FROM pg_stat_activity
      WHERE datname = current_database() AND ${blocker}::int = ANY(pg_blocking_pids(pid))
      UNION
      SELECT activity.pid FROM pg_stat_activity activity JOIN blocked ON blocked.pid = ANY(pg_blocking_pids(activity.pid))
      WHERE activity.datname = current_database()
    ) SELECT COUNT(*) AS waiting FROM blocked
  `;

  if (Number(rows[0]?.waiting) >= count) {
    return;
  }

  if (Date.now() >= deadline) {
    throw new Error("Nothing waited behind the held transaction's locks");
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  return waitForBlocked({ blocker, count, deadline });
}

export async function holdTransaction<Result>(
  work: (transaction: TransactionClient) => Promise<Result>,
) {
  const ready = Promise.withResolvers<number>();
  const release = Promise.withResolvers<null>();

  const held = prisma.$transaction(
    async (transaction) => {
      const result = await work(transaction);

      const [backend] = await transaction.$queryRaw<
        { pid: number }[]
      >`SELECT pg_backend_pid() AS pid`;

      if (!backend) {
        throw new Error("The held transaction has no backend");
      }

      ready.resolve(backend.pid);
      await release.promise;

      return result;
    },
    { timeout: 12_000 },
  );

  return { blocker: await ready.promise, held, release: () => release.resolve(null) };
}
