import { Prisma } from "./generated/prisma/client";
import { type TransactionClient } from "./index";

const COURSE_LOCK_NAMESPACE = 51_882;

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
