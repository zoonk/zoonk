import { type TransactionClient } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { projectPersistedEnergy } from "../progress/energy";

/** Call before other learner-row locks: owner then progress matches guest linking; capture completion time only after locking. */
export async function getCompletionEnergyContext({
  timeZone,
  transaction,
  userId,
}: {
  timeZone: string;
  transaction: TransactionClient;
  userId: string;
}): Promise<{ completedAt: Date; completionDate: Date; currentEnergy: number }> {
  await transaction.$queryRaw`
    SELECT "id"
    FROM "users"
    WHERE "id" = ${userId}::uuid
    FOR KEY SHARE
  `;

  await transaction.userProgress.createMany({ data: [{ userId }], skipDuplicates: true });

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
