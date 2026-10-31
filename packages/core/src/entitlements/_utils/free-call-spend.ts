import { type TransactionClient, sql } from "@zoonk/db";
import { getCallExposureMicros } from "../../language/conversations/_utils/live-call-money";

/** Reservations, transitions, and settlements must share this UTC-day lock. */
export async function lockFreeCallDay({
  day,
  transaction,
}: {
  day: Date;
  transaction: TransactionClient;
}): Promise<number> {
  await transaction.$executeRaw(sql`
    INSERT INTO free_call_spend_days (day, spent_micros) VALUES (${day}::date, 0)
    ON CONFLICT (day) DO NOTHING
  `);

  const [bucket] = await transaction.$queryRaw<{ spentMicros: number }[]>(sql`
    SELECT spent_micros AS "spentMicros" FROM free_call_spend_days WHERE day = ${day}::date FOR UPDATE
  `);

  return bucket?.spentMicros ?? 0;
}

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

/** Locks the shared UTC-day bucket before checking and claiming spend. */
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
  const spentMicros = await lockFreeCallDay({ day, transaction });
  const overrun = await openOverrunMicros({ day, now, transaction });

  if (spentMicros + overrun + costMicros > budgetMicros) {
    return false;
  }

  await transaction.freeCallSpendDay.update({
    data: { spentMicros: { increment: costMicros } },
    where: { day },
  });

  return true;
}
