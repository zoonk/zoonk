import { Prisma } from "./generated/prisma/client";
import { type TransactionClient } from "./index";

/** Namespaces course-home locks so they never collide with other advisory locks. */
const COURSE_LOCK_NAMESPACE = 51_882;

/** Course creation and guest links share this lock while writing into one home. */
export async function lockCourseHome({
  homeId,
  transaction,
}: {
  homeId: string;
  transaction: TransactionClient;
}): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(${COURSE_LOCK_NAMESPACE}::int, hashtext(${homeId}))::text`,
  );
}
