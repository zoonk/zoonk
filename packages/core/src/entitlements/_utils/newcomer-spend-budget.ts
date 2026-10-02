import { captureMessage } from "@sentry/nextjs";
import { type TransactionClient } from "@zoonk/db";
import { NEWCOMER_DAILY_SPEND_BUDGET_MICROS } from "../limits";
import { getUsagePeriodStarts } from "./usage-periods";

/** Past this share of the day's budget, Sentry hears about it, once. */
const ALERT_SHARE = 0.8;

const ALERT_MICROS = Math.floor(NEWCOMER_DAILY_SPEND_BUDGET_MICROS * ALERT_SHARE);

/** Whether this use took the day's spend from below the alert line to at or above it. */
function crossesNewcomerAlert({
  costMicros,
  spentMicros,
}: {
  costMicros: number;
  spentMicros: number;
}): boolean {
  return spentMicros >= ALERT_MICROS && spentMicros - costMicros < ALERT_MICROS;
}

/**
 * Takes one use's estimated cost from today's budget that all newcomers share. The conditional
 * increment holds the day's row lock, so concurrent newcomers can't pass the budget together, and
 * the one use that crosses 80% of it tells Sentry.
 */
export async function claimNewcomerSpend({
  costMicros,
  now,
  transaction,
}: {
  costMicros: number;
  now: Date;
  transaction: TransactionClient;
}): Promise<boolean> {
  const day = getUsagePeriodStarts(now).day;

  await transaction.newcomerSpendDay.createMany({ data: [{ day }], skipDuplicates: true });

  const { count } = await transaction.newcomerSpendDay.updateMany({
    data: { spentMicros: { increment: costMicros } },
    where: { day, spentMicros: { lte: NEWCOMER_DAILY_SPEND_BUDGET_MICROS - costMicros } },
  });

  if (count === 0) {
    return false;
  }

  const spent = await transaction.newcomerSpendDay.findUniqueOrThrow({ where: { day } });

  if (crossesNewcomerAlert({ costMicros, spentMicros: spent.spentMicros })) {
    captureMessage(
      `Newcomers passed the alert line of today's AI budget: ${spent.spentMicros} of ${NEWCOMER_DAILY_SPEND_BUDGET_MICROS} micros`,
      "warning",
    );
  }

  return true;
}
