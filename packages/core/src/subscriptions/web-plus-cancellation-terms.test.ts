import { describe, expect, it } from "vitest";
import { getWebPlusCancellationTerms } from "./web-plus-cancellation-terms";

const subscribedAt = new Date("2025-01-31T10:00:00Z");

function monthly(now: string, timeZone: string | null = "UTC") {
  return getWebPlusCancellationTerms({
    amountPaid: 2990,
    endingAt: null,
    interval: "month",
    now: new Date(now),
    periodEnd: new Date("2025-02-28T10:00:00Z"),
    periodStart: subscribedAt,
    subscribedAt,
    timeZone,
  });
}

function renewedYearly(now: string, endingAt: string | null = null) {
  return getWebPlusCancellationTerms({
    amountPaid: 12_000,
    endingAt: endingAt === null ? null : new Date(endingAt),
    interval: "year",
    now: new Date(now),
    periodEnd: new Date("2027-01-31T10:00:00Z"),
    periodStart: new Date("2026-01-31T10:00:00Z"),
    subscribedAt,
    timeZone: "UTC",
  });
}

describe(getWebPlusCancellationTerms, () => {
  it("offers the whole payment back within 14 days, or keeping Plus until the period ends", () => {
    expect(monthly("2025-02-05T09:00:00Z")).toMatchObject({
      cancellation: {
        endsAt: new Date("2025-02-28T10:00:00Z"),
        refundAmount: 0,
        unstartedMonths: 0,
      },
      withdrawal: { refundAmount: 2990, until: new Date("2025-02-14T23:59:59.999Z") },
    });
  });

  it("keeps the refund to the end of the 14th day after the purchase day where the learner subscribed", () => {
    const zone = "America/Sao_Paulo";

    expect(monthly("2025-02-15T02:59:00Z", zone).withdrawal).toStrictEqual({
      refundAmount: 2990,
      until: new Date("2025-02-15T02:59:59.999Z"),
    });

    expect(monthly("2025-02-15T03:00:00Z", zone).withdrawal).toBeNull();
  });

  it("keeps the refund a day and an hour past the 14 for a subscription with no time zone kept", () => {
    expect(monthly("2025-02-15T10:59:00Z", null).withdrawal).not.toBeNull();
    expect(monthly("2025-02-15T11:00:00Z", null).withdrawal).toBeNull();
  });

  it("refunds everything when the account is deleted within the 14 days", () => {
    expect(monthly("2025-02-05T09:00:00Z").accountDeletionRefund).toBe(2990);
    expect(monthly("2025-02-20T09:00:00Z").accountDeletionRefund).toBe(0);
  });

  it("refunds a renewed year's unstarted months when the account is deleted, unless they came back already", () => {
    const now = "2026-03-15T00:00:00Z";
    const unstarted = renewedYearly(now).cancellation.refundAmount;

    expect(unstarted).toBe(10_000);
    expect(renewedYearly(now).accountDeletionRefund).toBe(unstarted);
    expect(renewedYearly(now, "2027-01-31T10:00:00Z").accountDeletionRefund).toBe(unstarted);
    expect(renewedYearly(now, "2026-03-31T10:00:00Z").accountDeletionRefund).toBe(0);
  });

  it("only stops the renewal after 14 days", () => {
    expect(monthly("2025-02-20T09:00:00Z")).toMatchObject({
      cancellation: {
        endsAt: new Date("2025-02-28T10:00:00Z"),
        refundAmount: 0,
        unstartedMonths: 0,
      },
      withdrawal: null,
    });
  });

  it("keeps Plus until the period ends in a first year, without a refund", () => {
    const terms = getWebPlusCancellationTerms({
      amountPaid: 12_000,
      endingAt: null,
      interval: "year",
      now: new Date("2025-06-01T00:00:00Z"),
      periodEnd: new Date("2026-01-31T10:00:00Z"),
      periodStart: subscribedAt,
      subscribedAt,
      timeZone: "UTC",
    });

    expect(terms.cancellation).toStrictEqual({
      endsAt: new Date("2026-01-31T10:00:00Z"),
      refundAmount: 0,
      unstartedMonths: 0,
    });
  });

  it("refunds the months of a renewed year that haven't started, and ends at the current one's end", () => {
    expect(renewedYearly("2026-03-15T00:00:00Z").cancellation).toStrictEqual({
      endsAt: new Date("2026-03-31T10:00:00Z"),
      refundAmount: 10_000,
      unstartedMonths: 10,
    });
  });

  it("counts a month as started from the renewal's own day, clamped to shorter months", () => {
    expect(renewedYearly("2026-02-28T09:59:00Z").cancellation).toStrictEqual({
      endsAt: new Date("2026-02-28T10:00:00Z"),
      refundAmount: 11_000,
      unstartedMonths: 11,
    });

    expect(renewedYearly("2026-02-28T10:00:00Z").cancellation.unstartedMonths).toBe(10);
  });

  it("refunds nothing in the last month of a renewed year", () => {
    expect(renewedYearly("2027-01-10T00:00:00Z").cancellation).toStrictEqual({
      endsAt: new Date("2027-01-31T10:00:00Z"),
      refundAmount: 0,
      unstartedMonths: 0,
    });
  });

  it("rounds a twelfth to the nearest cent", () => {
    const terms = getWebPlusCancellationTerms({
      amountPaid: 9990,
      endingAt: null,
      interval: "year",
      now: new Date("2026-02-01T00:00:00Z"),
      periodEnd: new Date("2027-01-31T10:00:00Z"),
      periodStart: new Date("2026-01-31T10:00:00Z"),
      subscribedAt,
      timeZone: "UTC",
    });

    expect(terms.cancellation.refundAmount).toBe(9158);
  });

  it("refunds the full days left of the period when Plus ends now for an important reason", () => {
    // 28 days paid, 8 full days left on Feb 20 at 09:00: the day it ends counts as used.
    expect(monthly("2025-02-20T09:00:00Z").extraordinary).toStrictEqual({
      owed: 854,
      refundAmount: 854,
    });

    expect(monthly("2025-02-28T09:00:00Z").extraordinary.refundAmount).toBe(0);
  });

  it("counts an early end's days only once its unstarted months were refunded", () => {
    const terms = getWebPlusCancellationTerms({
      amountPaid: 12_000,
      endingAt: new Date("2026-03-31T10:00:00Z"),
      interval: "year",
      now: new Date("2026-03-15T00:00:00Z"),
      periodEnd: new Date("2027-01-31T10:00:00Z"),
      periodStart: new Date("2026-01-31T10:00:00Z"),
      subscribedAt,
      timeZone: "UTC",
    });

    // 16 full days of 365 come back now; the 10 unstarted months' 10,000 were refunded before.
    expect(terms.extraordinary).toStrictEqual({ owed: 10_526, refundAmount: 526 });
  });
});
