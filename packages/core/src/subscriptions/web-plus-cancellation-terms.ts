import { MS_PER_DAY } from "@zoonk/utils/date";
import { getRefundDeadline, isWithinRefundWindow } from "@zoonk/utils/subscription";

const MONTHS_PER_YEAR = 12;

export type WebPlusCancellationTerms = {
  cancellation: { endsAt: Date; refundAmount: number; unstartedMonths: number };
  /**
   * Ending now for an important reason (BGB § 314): the full days left until Plus would end come
   * back as a share of the period's days. `owed` is all the payment has refunded once it's done,
   * since a renewed year canceled before already got its unstarted months back.
   */
  extraordinary: { owed: number; refundAmount: number };
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

function getOrdinaryCancellation({
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
}): WebPlusCancellationTerms["cancellation"] {
  const renewedYear = interval === "year" && periodStart > subscribedAt;

  if (!renewedYear) {
    return { endsAt: periodEnd, refundAmount: 0, unstartedMonths: 0 };
  }

  const startedMonths = countStartedMonths({ now, periodStart });
  const unstartedMonths = MONTHS_PER_YEAR - startedMonths;

  return {
    endsAt: unstartedMonths > 0 ? addMonths(periodStart, startedMonths) : periodEnd,
    refundAmount: Math.round((amountPaid * unstartedMonths) / MONTHS_PER_YEAR),
    unstartedMonths,
  };
}

function countFullDays(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/**
 * After a yearly renewal, the Terms refund each month that hasn't started as a twelfth of the
 * payment. `endingAt` is when Plus ends if its renewal is already stopped.
 */
export function getWebPlusCancellationTerms({
  amountPaid,
  endingAt,
  interval,
  now,
  periodEnd,
  periodStart,
  subscribedAt,
}: {
  amountPaid: number;
  endingAt: Date | null;
  interval: "month" | "year";
  now: Date;
  periodEnd: Date;
  periodStart: Date;
  subscribedAt: Date;
}): WebPlusCancellationTerms {
  const withdrawal = isWithinRefundWindow({ now, subscribedAt })
    ? { refundAmount: amountPaid, until: getRefundDeadline(subscribedAt) }
    : null;

  const cancellation = getOrdinaryCancellation({
    amountPaid,
    interval,
    now,
    periodEnd,
    periodStart,
    subscribedAt,
  });

  const periodDays = Math.max(1, countFullDays(periodStart, periodEnd));
  const daysLeft = countFullDays(now, endingAt ?? periodEnd);
  const refundAmount = Math.round((amountPaid * daysLeft) / periodDays);
  const endsEarly = endingAt !== null && endingAt < periodEnd;

  return {
    cancellation,
    extraordinary: {
      owed: refundAmount + (endsEarly ? cancellation.refundAmount : 0),
      refundAmount,
    },
    withdrawal,
  };
}
