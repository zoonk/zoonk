import { describe, expect, it } from "vitest";
import { getWebPlusCancellationTerms } from "./web-plus-cancellation-terms";

const subscribedAt = new Date("2025-01-31T10:00:00Z");

function monthly(now: string) {
  return getWebPlusCancellationTerms({
    amountPaid: 2990,
    interval: "month",
    now: new Date(now),
    periodEnd: new Date("2025-02-28T10:00:00Z"),
    periodStart: subscribedAt,
    subscribedAt,
  });
}

function renewedYearly(now: string) {
  return getWebPlusCancellationTerms({
    amountPaid: 12_000,
    interval: "year",
    now: new Date(now),
    periodEnd: new Date("2027-01-31T10:00:00Z"),
    periodStart: new Date("2026-01-31T10:00:00Z"),
    subscribedAt,
  });
}

describe(getWebPlusCancellationTerms, () => {
  it("offers the whole payment back within 14 days, or keeping Plus until the period ends", () => {
    expect(monthly("2025-02-05T09:00:00Z")).toStrictEqual({
      cancellation: {
        endsAt: new Date("2025-02-28T10:00:00Z"),
        refundAmount: 0,
        unstartedMonths: 0,
      },
      withdrawal: { refundAmount: 2990, until: new Date("2025-02-14T10:00:00Z") },
    });
  });

  it("keeps the refund through the end of the 14th day after the purchase day, anywhere", () => {
    expect(monthly("2025-02-15T09:59:00Z").withdrawal).not.toBeNull();
    expect(monthly("2025-02-15T10:00:00Z").withdrawal).toBeNull();
  });

  it("only stops the renewal after 14 days", () => {
    expect(monthly("2025-02-20T09:00:00Z")).toStrictEqual({
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
      interval: "year",
      now: new Date("2025-06-01T00:00:00Z"),
      periodEnd: new Date("2026-01-31T10:00:00Z"),
      periodStart: subscribedAt,
      subscribedAt,
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
      interval: "year",
      now: new Date("2026-02-01T00:00:00Z"),
      periodEnd: new Date("2027-01-31T10:00:00Z"),
      periodStart: new Date("2026-01-31T10:00:00Z"),
      subscribedAt,
    });

    expect(terms.cancellation.refundAmount).toBe(9158);
  });
});
