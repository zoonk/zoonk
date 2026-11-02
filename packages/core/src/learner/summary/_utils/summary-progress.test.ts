import { type Subscription } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { describe, expect, it } from "vitest";
import { getNextChangeAt } from "./summary-progress";

const NOW = new Date("2026-03-10T12:00:00.000Z");
const HOUR_MS = 60 * 60 * 1000;

function appleSubscription({
  periodEnd,
  trialEnd = null,
}: {
  periodEnd: Date;
  trialEnd?: Date | null;
}): Subscription {
  return {
    billingInterval: "month",
    cancelAt: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    endedAt: null,
    id: "subscription",
    periodEnd,
    periodStart: new Date(periodEnd.getTime() - 30 * 24 * HOUR_MS),
    plan: "plus",
    provider: "apple",
    providerAcknowledged: null,
    providerEnvironment: "Production",
    providerEventId: null,
    providerProductId: "plus.monthly",
    providerSignedAt: null,
    providerSubscriptionId: "original-transaction",
    providerTransactionId: null,
    referenceId: "learner",
    seats: null,
    status: "active",
    stripeCustomerId: null,
    stripeScheduleId: null,
    stripeSubscriptionId: null,
    trialEnd,
    trialStart: null,
    userId: "learner",
  };
}

function nextChange({
  carriedUntil = null,
  now = NOW,
  subscription = null,
  timeZone,
}: {
  carriedUntil?: Date | null;
  now?: Date;
  subscription?: Subscription | null;
  timeZone: string;
}): string {
  return new Date(
    getNextChangeAt({
      carriedUntil,
      localDate: getDateInTimeZone({ date: now, timeZone }),
      now,
      sessionExpiresAt: new Date(now.getTime() + 30 * 24 * HOUR_MS),
      subscription,
      timeZone,
    }),
  ).toISOString();
}

describe(getNextChangeAt, () => {
  it("reads again when the allowance starts over at UTC midnight, before a later local one", () => {
    expect(nextChange({ timeZone: "America/Sao_Paulo" })).toBe("2026-03-11T00:00:00.000Z");
  });

  it("reads again at a local midnight that comes before UTC's", () => {
    expect(nextChange({ timeZone: "Asia/Tokyo" })).toBe("2026-03-10T15:00:00.000Z");
  });

  it("reads again when the month's allowance starts over, at the month's first UTC midnight", () => {
    const now = new Date("2026-03-31T20:00:00.000Z");

    expect(nextChange({ now, timeZone: "America/Los_Angeles" })).toBe("2026-04-01T00:00:00.000Z");
  });

  it("reads again when an App Store period ends before either midnight", () => {
    const periodEnd = new Date(NOW.getTime() + HOUR_MS);

    expect(nextChange({ subscription: appleSubscription({ periodEnd }), timeZone: "UTC" })).toBe(
      periodEnd.toISOString(),
    );
  });

  it("never waits for a moment already past", () => {
    const subscription = appleSubscription({
      periodEnd: new Date(NOW.getTime() + 40 * 24 * HOUR_MS),
      trialEnd: new Date(NOW.getTime() - HOUR_MS),
    });

    expect(
      nextChange({
        carriedUntil: new Date(NOW.getTime() - HOUR_MS),
        subscription,
        timeZone: "America/Sao_Paulo",
      }),
    ).toBe("2026-03-11T00:00:00.000Z");
  });

  it("reads again at the earliest change, a carried day's end before every midnight", () => {
    const carriedUntil = new Date(NOW.getTime() + 2 * HOUR_MS);

    expect(nextChange({ carriedUntil, timeZone: "America/Sao_Paulo" })).toBe(
      carriedUntil.toISOString(),
    );
  });
});
