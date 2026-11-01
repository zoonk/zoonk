import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { endWebPlusForDeletedAccount } from "./web-plus-account-deletion";
import { cancelWebPlus, getWebPlusCancellation, keepWebPlus } from "./web-plus-cancellation";
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

      await expect(getWebPlusCancellation()).resolves.toStrictEqual({
        canResumeRenewal: false,
        cancellation: { endsAt },
        status: "ready",
        unpaid: false,
      });

      await expect(cancelWebPlus()).resolves.toStrictEqual({
        endsAt,
        receivedAt: expect.any(Date),
        status: "canceled",
      });

      expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
        cancel_at_period_end: true,
      });

      expect(stripe.cancel).not.toHaveBeenCalled();

      await expect(
        prisma.subscription.findFirst({ where: { referenceId: user.id } }),
      ).resolves.toMatchObject({ cancelAt: endsAt, cancelAtPeriodEnd: true, status: "active" });
    },
  );

  it("stops the renewal of a website trial at the period end", async () => {
    const subscription = { ...stripeSubscription(), status: "trialing" as const };
    await subscribedLearner(subscription);
    await expect(cancelWebPlus()).resolves.toMatchObject({ status: "canceled" });

    expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
      cancel_at_period_end: true,
    });
  });

  it.each(["past_due", "unpaid"] as const)(
    "ends a %s renewal immediately to stop charge retries",
    async (status) => {
      const subscription = { ...stripeSubscription("month", true), status };
      const user = await subscribedLearner(subscription);
      const before = new Date();
      const outcome = await cancelWebPlus();

      expect(outcome).toMatchObject({
        endsAt: expect.any(Date),
        receivedAt: expect.any(Date),
        status: "canceled",
      });

      if (outcome?.status !== "canceled") {
        throw new Error("Expected cancellation");
      }

      expect(outcome.endsAt).toStrictEqual(outcome.receivedAt);
      expect(outcome.endsAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
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

    await expect(getWebPlusCancellation()).resolves.toStrictEqual({
      canResumeRenewal: true,
      cancellation: null,
      status: "ready",
      unpaid: false,
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

  it("leaves store subscriptions to their store", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    await addNewerStorePlus(user.id);

    await expect(getWebPlusCancellation()).resolves.toStrictEqual({
      provider: "apple",
      status: "store",
    });

    await expect(cancelWebPlus()).resolves.toStrictEqual({ status: "unavailable" });
    expect(stripe.update).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    await expect(cancelWebPlus()).resolves.toBeNull();
    await expect(keepWebPlus()).resolves.toBeNull();
    await expect(getWebPlusCancellation()).resolves.toBeNull();
    const user = { ...(await userFixture()), isAnonymous: true };
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    await expect(cancelWebPlus()).resolves.toBeNull();
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

  describe("account deletion", () => {
    it.each(["month", "year"] as const)(
      "ends the website %s immediately, even alongside a newer store purchase",
      async (interval) => {
        const subscription = stripeSubscription(interval, true);
        const user = await subscribedLearner(subscription);
        await addNewerStorePlus(user.id);
        await endWebPlusForDeletedAccount({ learner: user });
        expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, { prorate: false });
        expect(stripe.update).not.toHaveBeenCalled();

        await expect(
          prisma.subscription.findFirst({ where: { stripeSubscriptionId: subscription.id } }),
        ).resolves.toMatchObject({ status: "canceled" });

        await expect(
          prisma.subscription.findFirst({ where: { provider: "apple", userId: user.id } }),
        ).resolves.toMatchObject({ status: "active" });
      },
    );

    it("stops deletion when Stripe cannot end the subscription", async () => {
      const user = await subscribedLearner(stripeSubscription());
      stripe.cancel.mockRejectedValue(new Error("Stripe unavailable"));

      await expect(endWebPlusForDeletedAccount({ learner: user })).rejects.toThrow(
        "Stripe unavailable",
      );
    });
  });
});
