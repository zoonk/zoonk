import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUserSubscriptionCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getWebPlusSubscription } from "./get-web-plus-subscription";
import { cancelWebPlus, keepWebPlus } from "./web-plus-cancellation";
import type Stripe from "stripe";

const stripe = vi.hoisted(() => ({ cancel: vi.fn(), retrieve: vi.fn(), update: vi.fn() }));

// Stripe is an external service; subscription persistence uses the real database.
vi.mock("@zoonk/auth/stripe-client", () => ({
  stripeClient: {
    subscriptions: { cancel: stripe.cancel, retrieve: stripe.retrieve, update: stripe.update },
  },
}));

function stripeSubscription(interval: "month" | "year" = "month", cancelAtPeriodEnd = false) {
  const start = Math.floor(Date.now() / 1000) - 86_400;
  const end = start + (interval === "year" ? 365 : 30) * 86_400;

  return {
    cancel_at: cancelAtPeriodEnd ? end : null,
    cancel_at_period_end: cancelAtPeriodEnd,
    id: `sub_${randomUUID()}`,
    items: {
      data: [
        {
          current_period_end: end,
          current_period_start: start,
          price: { recurring: { interval } },
        },
      ],
    },
    status: "active",
  } as unknown as Stripe.Subscription;
}

async function subscribedLearner(subscription: Stripe.Subscription) {
  const user = await userFixture();
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

  await prisma.subscription.create({
    data: {
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      periodEnd: new Date(subscription.items.data[0]!.current_period_end * 1000),
      plan: "plus",
      provider: "stripe",
      referenceId: user.id,
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
    },
  });

  stripe.retrieve.mockResolvedValue(subscription);
  stripe.cancel.mockResolvedValue({ ...subscription, status: "canceled" });

  stripe.update.mockImplementation(
    async (_id: string, params: { cancel_at?: ""; cancel_at_period_end?: boolean }) => ({
      ...subscription,
      cancel_at: params.cancel_at_period_end
        ? subscription.items.data[0]!.current_period_end
        : null,
      cancel_at_period_end: params.cancel_at_period_end ?? false,
    }),
  );

  return user;
}

async function addNewerStorePlus(userId: string) {
  await prisma.subscription.create({
    data: {
      periodEnd: new Date(Date.now() + 86_400_000),
      plan: "plus",
      provider: "apple",
      providerSubscriptionId: randomUUID(),
      referenceId: userId,
      status: "active",
      userId,
    },
  });
}

describe("website Plus cancellation", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it.each(["month", "year"] as const)(
    "keeps the paid %s until its end and persists the stopped renewal",
    async (interval) => {
      const subscription = stripeSubscription(interval);
      const user = await subscribedLearner(subscription);
      const endsAt = new Date(subscription.items.data[0]!.current_period_end * 1000);

      await expect(getWebPlusSubscription()).resolves.toStrictEqual({
        periodEnd: endsAt,
        state: "renewing",
        status: "ready",
      });

      await expect(cancelWebPlus()).resolves.toStrictEqual({ endsAt, status: "canceled" });

      expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
        cancel_at_period_end: true,
      });

      expect(stripe.cancel).not.toHaveBeenCalled();

      await expect(
        prisma.subscription.findFirst({ where: { referenceId: user.id } }),
      ).resolves.toMatchObject({ cancelAt: endsAt, cancelAtPeriodEnd: true, status: "active" });
    },
  );

  it.each(["past_due", "unpaid"] as const)(
    "ends a %s renewal immediately to stop charge retries",
    async (status) => {
      const subscription = { ...stripeSubscription("month", true), status };
      const user = await subscribedLearner(subscription);
      const before = new Date();
      const outcome = await cancelWebPlus();

      expect(outcome).toMatchObject({ endsAt: expect.any(Date), status: "canceled" });

      if (outcome?.status !== "canceled") {
        throw new Error("Expected cancellation");
      }

      expect(outcome.endsAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(outcome.endsAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, { prorate: false });
      expect(stripe.update).not.toHaveBeenCalled();

      await expect(
        prisma.subscription.findFirst({ where: { referenceId: user.id } }),
      ).resolves.toMatchObject({ status: "canceled" });
    },
  );

  it("finds website Plus even when a store purchase is newer", async () => {
    const subscription = stripeSubscription();
    const user = await subscribedLearner(subscription);
    await addNewerStorePlus(user.id);
    await expect(cancelWebPlus()).resolves.toMatchObject({ status: "canceled" });

    expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
      cancel_at_period_end: true,
    });

    await expect(
      prisma.subscription.findFirst({ where: { provider: "apple", userId: user.id } }),
    ).resolves.toMatchObject({ cancelAtPeriodEnd: false, status: "active" });
  });

  it("keeps Plus by turning its renewal back on", async () => {
    const subscription = stripeSubscription("month", true);
    const user = await subscribedLearner(subscription);

    await expect(getWebPlusSubscription()).resolves.toStrictEqual({
      periodEnd: new Date(subscription.items.data[0]!.current_period_end * 1000),
      state: "ending",
      status: "ready",
    });

    await expect(keepWebPlus()).resolves.toStrictEqual({ status: "kept" });
    expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, { cancel_at: "" });

    await expect(
      prisma.subscription.findFirst({ where: { referenceId: user.id } }),
    ).resolves.toMatchObject({ cancelAt: null, cancelAtPeriodEnd: false, status: "active" });
  });

  it("resumes when Stripe keeps only the period-end flag", async () => {
    const subscription = { ...stripeSubscription("month", true), cancel_at: null };
    await subscribedLearner(subscription);
    await expect(keepWebPlus()).resolves.toStrictEqual({ status: "kept" });

    expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
      cancel_at_period_end: false,
    });
  });

  it("does not cancel an already stopped renewal or resume one still renewing", async () => {
    await subscribedLearner(stripeSubscription("month", true));
    await expect(cancelWebPlus()).resolves.toStrictEqual({ status: "unavailable" });
    await subscribedLearner(stripeSubscription());
    await expect(keepWebPlus()).resolves.toStrictEqual({ status: "unavailable" });
    expect(stripe.update).not.toHaveBeenCalled();
  });

  it.each([
    {
      expected: "ending",
      liveEnding: true,
      liveStatus: "active",
      operation: "cancel",
      savedEnding: false,
    },
    {
      expected: "none",
      liveEnding: false,
      liveStatus: "canceled",
      operation: "cancel",
      savedEnding: false,
    },
    {
      expected: "none",
      liveEnding: false,
      liveStatus: "canceled",
      operation: "keep",
      savedEnding: true,
    },
    {
      expected: "renewing",
      liveEnding: false,
      liveStatus: "active",
      operation: "keep",
      savedEnding: true,
    },
    {
      expected: "unpaid",
      liveEnding: false,
      liveStatus: "past_due",
      operation: "cancel",
      savedEnding: false,
    },
    {
      expected: "unpaid",
      liveEnding: false,
      liveStatus: "unpaid",
      operation: "cancel",
      savedEnding: false,
    },
    {
      expected: "unpaid",
      liveEnding: true,
      liveStatus: "past_due",
      operation: "keep",
      savedEnding: true,
    },
  ] as const)(
    "reconciles $operation against live $liveStatus / ending=$liveEnding before answering",
    async ({ operation, savedEnding, liveEnding, liveStatus, expected }) => {
      const saved = stripeSubscription("month", savedEnding);
      const user = await subscribedLearner(saved);
      const periodEnd = new Date(saved.items.data[0]!.current_period_end * 1000);

      const live = {
        ...saved,
        cancel_at: liveEnding ? saved.items.data[0]!.current_period_end : null,
        cancel_at_period_end: liveEnding,
        status: liveStatus,
      };

      stripe.retrieve.mockResolvedValue(live);
      const action = operation === "cancel" ? cancelWebPlus : keepWebPlus;

      await expect(action()).resolves.toStrictEqual({ status: "unavailable" });

      await expect(
        prisma.subscription.findFirst({ where: { referenceId: user.id } }),
      ).resolves.toMatchObject({
        cancelAt: liveEnding ? periodEnd : null,
        cancelAtPeriodEnd: liveEnding,
        status: liveStatus,
      });

      const expectedPeriodEnd = expected === "unpaid" ? null : periodEnd;

      const snapshot =
        expected === "none"
          ? { status: "none" }
          : { periodEnd: expectedPeriodEnd, state: expected, status: "ready" };

      await expect(getWebPlusSubscription()).resolves.toStrictEqual(snapshot);

      expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(getUserSubscriptionCacheTag(user.id), {
        expire: 0,
      });

      expect(stripe.cancel).not.toHaveBeenCalled();
      expect(stripe.update).not.toHaveBeenCalled();
    },
  );

  it("refreshes a changed billing period before canceling it", async () => {
    const saved = stripeSubscription();
    const user = await subscribedLearner(saved);
    const item = saved.items.data[0]!;
    const end = item.current_period_end + 86_400;

    stripe.retrieve.mockResolvedValue({
      ...saved,
      items: { data: [{ ...item, current_period_end: end }] },
    });

    await expect(cancelWebPlus()).resolves.toStrictEqual({ status: "unavailable" });

    await expect(getWebPlusSubscription()).resolves.toStrictEqual({
      periodEnd: new Date(end * 1000),
      state: "renewing",
      status: "ready",
    });

    expect(stripe.update).not.toHaveBeenCalled();

    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(getUserSubscriptionCacheTag(user.id), {
      expire: 0,
    });
  });

  it("ends a newly unpaid renewal only after the learner can confirm its corrected state", async () => {
    const saved = stripeSubscription();
    await subscribedLearner(saved);
    stripe.retrieve.mockResolvedValue({ ...saved, status: "past_due" });
    await expect(cancelWebPlus()).resolves.toStrictEqual({ status: "unavailable" });
    expect(stripe.cancel).not.toHaveBeenCalled();

    await expect(getWebPlusSubscription()).resolves.toStrictEqual({
      periodEnd: null,
      state: "unpaid",
      status: "ready",
    });

    await expect(cancelWebPlus()).resolves.toMatchObject({ status: "canceled" });
    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(saved.id, { prorate: false });
  });

  it("leaves store subscriptions to their store", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    await addNewerStorePlus(user.id);

    await expect(getWebPlusSubscription()).resolves.toStrictEqual({ status: "none" });

    await expect(cancelWebPlus()).resolves.toStrictEqual({ status: "unavailable" });
    expect(stripe.update).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    await expect(cancelWebPlus()).resolves.toBeNull();
    await expect(keepWebPlus()).resolves.toBeNull();
    await expect(getWebPlusSubscription()).resolves.toBeNull();
    const user = { ...(await userFixture()), isAnonymous: true };
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    await expect(cancelWebPlus()).resolves.toStrictEqual({ status: "none" });
    await expect(keepWebPlus()).resolves.toStrictEqual({ status: "none" });
    await expect(getWebPlusSubscription()).resolves.toStrictEqual({ status: "none" });
    expect(stripe.retrieve).not.toHaveBeenCalled();
  });

  it("propagates Stripe failures without changing the saved renewal", async () => {
    const user = await subscribedLearner(stripeSubscription());
    stripe.update.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(cancelWebPlus()).rejects.toThrow("Stripe unavailable");

    await expect(
      prisma.subscription.findFirst({ where: { referenceId: user.id } }),
    ).resolves.toMatchObject({ cancelAtPeriodEnd: false });
  });
});
