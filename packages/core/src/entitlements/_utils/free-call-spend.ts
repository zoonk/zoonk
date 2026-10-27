import { type TransactionClient, sql } from "@zoonk/db";
import { getCallExposureMicros } from "../../language/conversations/_utils/live-call-money";

/**
 * What the day's open free calls may cost beyond what they posted: a call whose hangup keeps
 * failing adds its overrun by the clock, and a reservation past its connect window takes back
 * what it posted. Only calls in progress are open, so the sum stays small.
 */
async function openOverrunMicros({
  day,
  now,
  transaction,
}: {
  day: Date;
  now: Date;
  transaction: TransactionClient;
}): Promise<number> {
  const open = await transaction.liveCallConnection.findMany({
    where: { freeSpendDay: day, state: { not: "ended" } },
  });

  return open.reduce(
    (total, connection) =>
      total + getCallExposureMicros({ connection, now }) - connection.costMicros,
    0,
  );
}

/**
 * Takes a free call's reservation from the UTC day's shared bucket, or refuses it when the day's
 * posted cost and its open calls' overrun leave no room. The bucket row is locked first, so free
 * learners starting at once take turns and a settlement posting to it waits.
 */
export async function claimFreeCallSpend({
  budgetMicros,
  costMicros,
  day,
  now,
  transaction,
}: {
  budgetMicros: number;
  costMicros: number;
  day: Date;
  now: Date;
  transaction: TransactionClient;
}): Promise<boolean> {
  await transaction.$executeRaw(sql`
    INSERT INTO free_call_spend_days (day, spent_micros) VALUES (${day}::date, 0)
    ON CONFLICT (day) DO NOTHING
  `);

  const [bucket] = await transaction.$queryRaw<{ spentMicros: number }[]>(sql`
    SELECT spent_micros AS "spentMicros" FROM free_call_spend_days WHERE day = ${day}::date FOR UPDATE
  `);

  const overrun = await openOverrunMicros({ day, now, transaction });

  if ((bucket?.spentMicros ?? 0) + overrun + costMicros > budgetMicros) {
    return false;
  }

  await transaction.freeCallSpendDay.update({
    data: { spentMicros: { increment: costMicros } },
    where: { day },
  });

  return true;
}
