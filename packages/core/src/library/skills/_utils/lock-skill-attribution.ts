import "server-only";
import { type TransactionClient } from "@zoonk/db";

const SKILL_ATTRIBUTION_LOCK_NAMESPACE = 51_879;

/**
 * Recovery must hold a stable set of skill links until its null-only writes commit. Merges take
 * the same lock before moving any pointers; shared locks let ordinary merges run concurrently.
 * A merge already holds plan and user rows, so it rolls back instead of waiting on recovery.
 * PostgreSQL releases both modes when their transaction commits or rolls back.
 */
export async function lockSkillAttribution({
  mode,
  tx,
}: {
  mode: "merge" | "recovery";
  tx: TransactionClient;
}): Promise<boolean> {
  if (mode === "recovery") {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${SKILL_ATTRIBUTION_LOCK_NAMESPACE}::int, 0)::text`;
    return true;
  }

  const [row] = await tx.$queryRaw<{ acquired: boolean }[]>`
    SELECT pg_try_advisory_xact_lock_shared(${SKILL_ATTRIBUTION_LOCK_NAMESPACE}::int, 0) AS acquired
  `;

  return row?.acquired ?? false;
}
