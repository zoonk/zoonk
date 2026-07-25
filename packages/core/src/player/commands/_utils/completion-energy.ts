import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { projectPersistedEnergy } from "../../../progress/energy";

/**
 * Serializes a learner's Energy updates before capturing the completion time.
 * Capturing the clock after the lock keeps lastActiveAt monotonic even when two
 * requests entered the transaction in the opposite order.
 */
export async function getCompletionEnergyContext({
  timeZone,
  transaction,
  userId,
}: {
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<{ completedAt: Date; completionDate: Date; currentEnergy: number }> {
  await transaction.userProgress.upsert({ create: { userId }, update: {}, where: { userId } });

  await transaction.$queryRaw`
    SELECT "id"
    FROM "user_progress"
    WHERE "user_id" = ${userId}::uuid
    FOR UPDATE
  `;

  const completedAt = new Date();
  const completionDate = getDateInTimeZone({ date: completedAt, timeZone });
  const progress = await transaction.userProgress.findUniqueOrThrow({ where: { userId } });

  const projection = projectPersistedEnergy({
    persistedEnergy: progress,
    targetDate: completionDate,
    timeZone,
  });

  return { completedAt, completionDate, currentEnergy: projection.currentEnergy };
}
