import { captureMessage } from "@sentry/nextjs";
import { type TransactionClient, sql } from "@zoonk/db";
import { GUEST_DAILY_SPEND_BUDGET_MICROS } from "../limits";
import { getUsagePeriodStarts } from "./usage-periods";

const ALERT_SHARE = 0.8;

const ALERT_MICROS = Math.floor(GUEST_DAILY_SPEND_BUDGET_MICROS * ALERT_SHARE);

function crossesGuestAlert({
  costMicros,
  spentMicros,
}: {
  costMicros: number;
  spentMicros: number;
}): boolean {
  return spentMicros >= ALERT_MICROS && spentMicros - costMicros < ALERT_MICROS;
}

export async function claimGuestSpend({
  costMicros,
  now,
  transaction,
}: {
  costMicros: number;
  now: Date;
  transaction: TransactionClient;
}): Promise<boolean> {
  if (costMicros > GUEST_DAILY_SPEND_BUDGET_MICROS) {
    return false;
  }

  const day = getUsagePeriodStarts(now).day;

  const [spent] = await transaction.$queryRaw<{ spentMicros: number }[]>(sql`
    INSERT INTO guest_spend_days (day, spent_micros)
    VALUES (${day}::date, ${costMicros})
    ON CONFLICT (day) DO UPDATE
      SET spent_micros = guest_spend_days.spent_micros + EXCLUDED.spent_micros
      WHERE guest_spend_days.spent_micros + EXCLUDED.spent_micros <= ${GUEST_DAILY_SPEND_BUDGET_MICROS}
    RETURNING spent_micros AS "spentMicros"
  `);

  if (!spent) {
    return false;
  }

  if (crossesGuestAlert({ costMicros, spentMicros: spent.spentMicros })) {
    captureMessage(
      `Guests passed the alert line of today's AI budget: ${spent.spentMicros} of ${GUEST_DAILY_SPEND_BUDGET_MICROS} micros`,
      "warning",
    );
  }

  return true;
}

/**
 * For a call that a feature's own cap admits in the caller's transaction, such as a grade: a
 * guest's also takes from the day all guests share. False means the guest must sign up.
 */
export async function claimGuestShare({
  costMicros,
  transaction,
  userId,
}: {
  costMicros: number;
  transaction: TransactionClient;
  userId: string;
}): Promise<boolean> {
  const user = await transaction.user.findUnique({
    select: { isAnonymous: true },
    where: { id: userId },
  });

  return !user?.isAnonymous || claimGuestSpend({ costMicros, now: new Date(), transaction });
}
