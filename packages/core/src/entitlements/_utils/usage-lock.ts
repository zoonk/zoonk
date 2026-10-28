import { type TransactionClient, sql } from "@zoonk/db";

const USAGE_LOCK_NAMESPACE = 51_873;

export async function lockUsageForViewer({
  transaction,
  userId,
}: {
  transaction: TransactionClient;
  userId: string;
}): Promise<void> {
  await transaction.$queryRaw(
    sql`SELECT pg_advisory_xact_lock(${USAGE_LOCK_NAMESPACE}::int, hashtext(${userId}))::text`,
  );
}
