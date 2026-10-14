import "server-only";
import { type TransactionClient, sql } from "@zoonk/db";

const SKILL_ATTRIBUTION_LOCK_NAMESPACE = 51_879;

/**
 * Recovery must hold a stable set of skill links until its null-only writes commit. Merges take
 * the same lock before moving any pointers; shared locks let ordinary merges run concurrently.
 * PostgreSQL releases both modes when their transaction commits or rolls back.
 */
export async function lockSkillAttribution({
  mode,
  tx,
}: {
  mode: "merge" | "recovery";
  tx: TransactionClient;
}): Promise<void> {
  await tx.$queryRaw(
    mode === "recovery"
      ? sql`SELECT pg_advisory_xact_lock(${SKILL_ATTRIBUTION_LOCK_NAMESPACE}::int, 0)::text`
      : sql`SELECT pg_advisory_xact_lock_shared(${SKILL_ATTRIBUTION_LOCK_NAMESPACE}::int, 0)::text`,
  );
}
