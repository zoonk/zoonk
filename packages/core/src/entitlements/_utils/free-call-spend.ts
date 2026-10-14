import { type TransactionClient, sql } from "@zoonk/db";
import { getLiveCallLiability } from "../../language/conversations/_utils/live-call-policy";

/**
 * What the day's open calls owe beyond what its bucket holds: liability is posted only when a close
 * runs, so a call that can't close keeps owing more than the bucket shows until it settles.
 */
async function unpostedLiability({
  day,
  now,
  transaction,
}: {
  day: Date;
  now: Date;
  transaction: TransactionClient;
}): Promise<number> {
  const open = await transaction.liveCallConnection.findMany({
    where: { freeSpendDay: day, state: { not: "closed" } },
  });

  return open.reduce(
    (total, connection) =>
      total + getLiveCallLiability({ connection, now }) - connection.liabilityMicros,
    0,
  );
}

/** Conditional upsert serializes different free learners on their original UTC day's bucket. */
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
  const available = budgetMicros - (await unpostedLiability({ day, now, transaction }));

  if (costMicros > available) {
    return false;
  }

  const rows = await transaction.$queryRaw<{ spentMicros: number }[]>(sql`
    INSERT INTO free_call_spend_days (day, spent_micros) VALUES (${day}::date, ${costMicros})
    ON CONFLICT (day) DO UPDATE SET spent_micros = free_call_spend_days.spent_micros + EXCLUDED.spent_micros
    WHERE free_call_spend_days.spent_micros + EXCLUDED.spent_micros <= ${available}
    RETURNING spent_micros AS "spentMicros"
  `);

  return rows.length > 0;
}
