import { getRefundDeadline, isWithinRefundWindow } from "@zoonk/utils/subscription";

const MONTHS_PER_YEAR = 12;

export type WebPlusCancellationTerms = {
  cancellation: { endsAt: Date; refundAmount: number; unstartedMonths: number };
  /** The EU's right of withdrawal, which the Terms give everyone: Plus ends now, all of it refunded. */
  withdrawal: { refundAmount: number; until: Date } | null;
};

/** Calendar months, clamped to a shorter month's last day as Stripe's billing dates are. */
function addMonths(date: Date, months: number): Date {
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);

  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

function countStartedMonths({ now, periodStart }: { now: Date; periodStart: Date }): number {
  let started = 1;

  while (started < MONTHS_PER_YEAR && addMonths(periodStart, started) <= now) {
    started += 1;
  }

  return started;
}

/** After a yearly renewal, the Terms refund each month that hasn't started as a twelfth of the payment. */
export function getWebPlusCancellationTerms({
  amountPaid,
  interval,
  now,
  periodEnd,
  periodStart,
  subscribedAt,
}: {
  amountPaid: number;
  interval: "month" | "year";
  now: Date;
  periodEnd: Date;
  periodStart: Date;
  subscribedAt: Date;
}): WebPlusCancellationTerms {
  const withdrawal = isWithinRefundWindow({ now, subscribedAt })
    ? { refundAmount: amountPaid, until: getRefundDeadline(subscribedAt) }
    : null;

  const renewedYear = interval === "year" && periodStart > subscribedAt;

  if (!renewedYear) {
    return { cancellation: { endsAt: periodEnd, refundAmount: 0, unstartedMonths: 0 }, withdrawal };
  }

  const startedMonths = countStartedMonths({ now, periodStart });
  const unstartedMonths = MONTHS_PER_YEAR - startedMonths;

  return {
    cancellation: {
      endsAt: unstartedMonths > 0 ? addMonths(periodStart, startedMonths) : periodEnd,
      refundAmount: Math.round((amountPaid * unstartedMonths) / MONTHS_PER_YEAR),
      unstartedMonths,
    },
    withdrawal,
  };
}
