import { type TransactionClient, sql } from "@zoonk/db";

/** Conditional upsert serializes different free learners on their original UTC day's bucket. */
export async function claimFreeCallSpend({
  budgetMicros,
  costMicros,
  day,
  transaction,
}: {
  budgetMicros: number;
  costMicros: number;
  day: Date;
  transaction: TransactionClient;
}): Promise<boolean> {
  if (costMicros > budgetMicros) {
    return false;
  }

  const rows = await transaction.$queryRaw<{ spentMicros: number }[]>(sql`
    INSERT INTO free_call_spend_days (day, spent_micros) VALUES (${day}::date, ${costMicros})
    ON CONFLICT (day) DO UPDATE SET spent_micros = free_call_spend_days.spent_micros + EXCLUDED.spent_micros
    WHERE free_call_spend_days.spent_micros + EXCLUDED.spent_micros <= ${budgetMicros}
    RETURNING spent_micros AS "spentMicros"
  `);

  return rows.length > 0;
}
