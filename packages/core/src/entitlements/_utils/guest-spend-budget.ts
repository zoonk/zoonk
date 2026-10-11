import { captureMessage } from "@sentry/nextjs";
import { type TransactionClient, sql } from "@zoonk/db";
import { GUEST_DAILY_SPEND_BUDGET_MICROS } from "../limits";
import { getUsagePeriodStarts } from "./usage-periods";

/** Past this share of the day's budget, Sentry hears about it, once. */
const ALERT_SHARE = 0.8;

const ALERT_MICROS = Math.floor(GUEST_DAILY_SPEND_BUDGET_MICROS * ALERT_SHARE);

/** Whether this use took the day's spend from below the alert line to at or above it. */
function crossesGuestAlert({
  costMicros,
  spentMicros,
}: {
  costMicros: number;
  spentMicros: number;
}): boolean {
  return spentMicros >= ALERT_MICROS && spentMicros - costMicros < ALERT_MICROS;
}

/**
 * Takes one use's estimated cost from today's budget that all guests share, in one statement: it
 * creates the day's row or adds to it only while the total stays within the budget, holding the
 * row's lock, so concurrent guests can't pass the budget together and a row cleared meanwhile is
 * created again instead of refusing. The one use that crosses 80% of it tells Sentry.
 */
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
