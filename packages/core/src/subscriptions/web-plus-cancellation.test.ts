import { randomUUID } from "node:crypto";
import { isHumanRequest } from "@zoonk/auth/human-check";
import { sendPlusCancellationEmail } from "@zoonk/auth/plus-emails";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import {
  cancelWebPlus,
  getWebPlusCancellation,
  requestWebPlusCancellation,
} from "./web-plus-cancellation";
import type Stripe from "stripe";

const stripe = vi.hoisted(() => ({
  cancel: vi.fn(),
  paymentIntent: vi.fn(),
  refund: vi.fn(),
  retrieve: vi.fn(),
  update: vi.fn(),
  voidInvoice: vi.fn(),
}));

// Stripe and the mailer are external services; the learner's subscription row is real.
vi.mock("@zoonk/auth/stripe-client", () => ({
  stripeClient: {
    invoices: { voidInvoice: stripe.voidInvoice },
    paymentIntents: { retrieve: stripe.paymentIntent },
    refunds: { create: stripe.refund },
    subscriptions: { cancel: stripe.cancel, retrieve: stripe.retrieve, update: stripe.update },
  },
}));

vi.mock("@zoonk/auth/plus-emails", () => ({ sendPlusCancellationEmail: vi.fn() }));

// BotID needs Vercel's request context.
vi.mock("@zoonk/auth/human-check", () => ({ isHumanRequest: vi.fn() }));

const DAY = 86_400;

function stripeSubscription({
  amountPaid,
  cancelAtDaysFromNow,
  cancelAtPeriodEnd = false,
  interval,
  periodStartDaysAgo,
  status = "active",
  subscribedDaysAgo,
}: {
  amountPaid: number;
  cancelAtDaysFromNow?: number;
  cancelAtPeriodEnd?: boolean;
  interval: "month" | "year";
  periodStartDaysAgo: number;
  status?: Stripe.Subscription.Status;
  subscribedDaysAgo: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const periodStart = now - periodStartDaysAgo * DAY;
  const periodEnd = periodStart + (interval === "year" ? 365 : 30) * DAY;
  const cancelAt = cancelAtDaysFromNow === undefined ? null : now + cancelAtDaysFromNow * DAY;

  return {
    cancel_at: cancelAt,
    cancel_at_period_end: cancelAtPeriodEnd,
    id: `sub_${randomUUID()}`,
    items: {
      data: [
        {
          // Stripe ends the current period at an earlier `cancel_at`.
          current_period_end: cancelAt ?? periodEnd,
          current_period_start: periodStart,
          price: { recurring: { interval } },
        },
      ],
    },
    latest_invoice: {
      amount_paid: amountPaid,
      currency: "eur",
      id: `in_${randomUUID()}`,
      lines: { data: [{ period: { end: periodEnd, start: periodStart } }] },
      payments: { data: [{ payment: { payment_intent: "pi_paid" }, status: "paid" }] },
      status: status === "active" ? "paid" : "open",
    },
    start_date: now - subscribedDaysAgo * DAY,
    status,
  } as unknown as Stripe.Subscription;
}

async function subscribedLearner({
  provider = "stripe",
  refunded = 0,
  subscription,
}: {
  provider?: "apple" | "stripe";
  refunded?: number;
  subscription?: Stripe.Subscription;
}) {
  const user = await userFixture();
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

  await prisma.subscription.create({
    data: {
      periodEnd: new Date(Date.now() + DAY * 1000),
      plan: "plus",
      provider,
      providerSubscriptionId: provider === "stripe" ? null : randomUUID(),
      referenceId: user.id,
      status: subscription?.status ?? "active",
      stripeSubscriptionId: subscription?.id,
      userId: provider === "stripe" ? null : user.id,
    },
  });

  if (subscription) {
    stripe.retrieve.mockResolvedValue(subscription);
  }

  stripe.paymentIntent.mockResolvedValue({ latest_charge: { amount_refunded: refunded } });
  stripe.cancel.mockResolvedValue({ ...subscription, status: "canceled" });

  stripe.update.mockImplementation(
    async (_id: string, params: { cancel_at?: number; cancel_at_period_end?: boolean }) => ({
      ...subscription,
      cancel_at: params.cancel_at ?? null,
      cancel_at_period_end: params.cancel_at_period_end ?? false,
    }),
  );

  stripe.refund.mockResolvedValue({ id: "re_test", status: "succeeded" });

  return user;
}

describe("web Plus cancellation", () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null);
    vi.mocked(isHumanRequest).mockResolvedValue(true);
  });

  it("refunds the whole payment and ends Plus now when the learner withdraws within 14 days", async () => {
    const subscription = stripeSubscription({
      amountPaid: 999,
      interval: "month",
      periodStartDaysAgo: 3,
      subscribedDaysAgo: 3,
    });

    const user = await subscribedLearner({ subscription });
    const outcome = await cancelWebPlus({ locale: "de", request: { choice: "withdrawal" } });

    expect(outcome).toMatchObject({ refund: { amount: 999, currency: "eur" }, status: "canceled" });

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      { amount: 999, payment_intent: "pi_paid", reason: "requested_by_customer" },
      { idempotencyKey: expect.stringMatching(/^plus-refund-in_.+-0$/u) },
    );

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, { prorate: false });

    await expect(
      prisma.subscription.findFirst({ where: { referenceId: user.id } }),
    ).resolves.toMatchObject({ status: "canceled" });

    expect(stripe.refund.mock.invocationCallOrder[0]).toBeLessThan(
      stripe.cancel.mock.invocationCallOrder[0] ?? 0,
    );

    expect(sendPlusCancellationEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        choice: "withdrawal",
        email: user.email,
        lateWithdrawal: false,
        locale: "de",
        name: user.name,
        refund: { amount: 999, currency: "eur" },
      }),
    );
  });

  it("offers both choices within 14 days, and only stops the renewal after them", async () => {
    await subscribedLearner({
      subscription: stripeSubscription({
        amountPaid: 999,
        interval: "month",
        periodStartDaysAgo: 3,
        subscribedDaysAgo: 3,
      }),
    });

    await expect(getWebPlusCancellation()).resolves.toMatchObject({
      cancellation: { refundAmount: 0 },
      status: "ready",
      withdrawal: { refundAmount: 999 },
    });

    await subscribedLearner({
      subscription: stripeSubscription({
        amountPaid: 999,
        interval: "month",
        periodStartDaysAgo: 20,
        subscribedDaysAgo: 20,
      }),
    });

    await expect(getWebPlusCancellation()).resolves.toMatchObject({
      status: "ready",
      withdrawal: null,
    });

    await expect(
      cancelWebPlus({ locale: "en", request: { choice: "withdrawal" } }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    expect(stripe.refund).not.toHaveBeenCalled();
  });

  it("stops the renewal without a refund, keeping Plus until the period ends", async () => {
    const subscription = stripeSubscription({
      amountPaid: 999,
      interval: "month",
      periodStartDaysAgo: 20,
      subscribedDaysAgo: 50,
    });

    const user = await subscribedLearner({ subscription });
    const outcome = await cancelWebPlus({ locale: "en", request: { choice: "ordinary" } });

    expect(outcome).toMatchObject({ refund: null, status: "canceled" });
    expect(stripe.refund).not.toHaveBeenCalled();

    expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
      cancel_at_period_end: true,
    });

    await expect(
      prisma.subscription.findFirst({ where: { referenceId: user.id } }),
    ).resolves.toMatchObject({ cancelAtPeriodEnd: true, status: "active" });
  });

  it("refunds a renewed year's months that haven't started and ends at the current month's end", async () => {
    const subscription = stripeSubscription({
      amountPaid: 12_000,
      interval: "year",
      periodStartDaysAgo: 40,
      subscribedDaysAgo: 405,
    });

    await subscribedLearner({ subscription });
    const outcome = await cancelWebPlus({ locale: "en", request: { choice: "ordinary" } });

    expect(outcome).toMatchObject({ refund: { amount: 10_000, currency: "eur" } });

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 10_000, payment_intent: "pi_paid" }),
      expect.anything(),
    );

    expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
      cancel_at: expect.any(Number),
      proration_behavior: "none",
    });
  });

  it("refunds only what's still owed, and still cancels once nothing is", async () => {
    const subscription = stripeSubscription({
      amountPaid: 999,
      interval: "month",
      periodStartDaysAgo: 3,
      subscribedDaysAgo: 3,
    });

    await subscribedLearner({ refunded: 400, subscription });
    await cancelWebPlus({ locale: "en", request: { choice: "withdrawal" } });

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 599 }),
      { idempotencyKey: expect.stringMatching(/-400$/u) },
    );

    await subscribedLearner({ refunded: 999, subscription });
    await cancelWebPlus({ locale: "en", request: { choice: "withdrawal" } });

    expect(stripe.refund).toHaveBeenCalledOnce();
    expect(stripe.cancel).toHaveBeenCalledTimes(2);
  });

  it("keeps Plus when Stripe refuses the refund", async () => {
    await subscribedLearner({
      subscription: stripeSubscription({
        amountPaid: 999,
        interval: "month",
        periodStartDaysAgo: 3,
        subscribedDaysAgo: 3,
      }),
    });

    stripe.refund.mockResolvedValue({ id: "re_failed", status: "failed" });

    await expect(
      cancelWebPlus({ locale: "en", request: { choice: "withdrawal" } }),
    ).rejects.toThrow("re_failed");

    expect(stripe.cancel).not.toHaveBeenCalled();
  });

  it("ends an unpaid renewal now and stops Stripe from collecting it", async () => {
    const subscription = stripeSubscription({
      amountPaid: 0,
      interval: "month",
      periodStartDaysAgo: 3,
      status: "past_due",
      subscribedDaysAgo: 60,
    });

    await subscribedLearner({ subscription });

    await expect(getWebPlusCancellation()).resolves.toMatchObject({
      cancellation: { refundAmount: 0 },
      status: "ready",
      unpaid: true,
      withdrawal: null,
    });

    await expect(
      cancelWebPlus({ locale: "en", request: { choice: "ordinary" } }),
    ).resolves.toMatchObject({ refund: null, status: "canceled" });

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, { prorate: false });
    expect(stripe.voidInvoice).toHaveBeenCalledOnce();
    expect(stripe.refund).not.toHaveBeenCalled();
  });

  it("still confirms an unpaid renewal's cancel when voiding its invoice fails", async () => {
    await subscribedLearner({
      subscription: stripeSubscription({
        amountPaid: 0,
        interval: "month",
        periodStartDaysAgo: 3,
        status: "past_due",
        subscribedDaysAgo: 60,
      }),
    });

    stripe.voidInvoice.mockRejectedValue(new Error("Stripe is down"));

    await expect(
      cancelWebPlus({ locale: "en", request: { choice: "ordinary" } }),
    ).resolves.toMatchObject({ status: "canceled" });

    expect(sendPlusCancellationEmail).toHaveBeenCalledOnce();
  });

  it("leaves a store subscription to its store", async () => {
    await subscribedLearner({ provider: "apple" });

    await expect(getWebPlusCancellation()).resolves.toStrictEqual({
      provider: "apple",
      status: "store",
    });

    await expect(
      cancelWebPlus({ locale: "en", request: { choice: "ordinary" } }),
    ).resolves.toStrictEqual({ status: "unavailable" });

    expect(stripe.retrieve).not.toHaveBeenCalled();
  });

  it("asks for an account first", async () => {
    await expect(getWebPlusCancellation()).resolves.toBeNull();

    await expect(
      cancelWebPlus({ locale: "en", request: { choice: "withdrawal" } }),
    ).resolves.toBeNull();
  });

  it("ends Plus now for an important reason and refunds the full days left", async () => {
    const subscription = stripeSubscription({
      amountPaid: 999,
      interval: "month",
      periodStartDaysAgo: 10,
      subscribedDaysAgo: 50,
    });

    const user = await subscribedLearner({ subscription });

    // 19 full days of 30 are left: the day it ends counts as used.
    await expect(getWebPlusCancellation()).resolves.toMatchObject({
      extraordinary: { refundAmount: 633 },
      withdrawal: null,
    });

    const outcome = await cancelWebPlus({
      locale: "en",
      request: { choice: "extraordinary", reason: "I'm moving abroad" },
    });

    expect(outcome).toMatchObject({ refund: { amount: 633, currency: "eur" }, status: "canceled" });

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 633 }),
      expect.anything(),
    );

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, {
      cancellation_details: { comment: "I'm moving abroad" },
      prorate: false,
    });

    expect(sendPlusCancellationEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        choice: "extraordinary",
        email: user.email,
        reason: "I'm moving abroad",
        refundableUntil: null,
      }),
    );
  });

  it("refunds only the days left after a renewed year's earlier cancel refunded its unstarted months", async () => {
    // Renewed 40 days ago and canceled the usual way: 10 unstarted months came back, and Plus ends
    // with the second month, 21 days from now.
    const subscription = stripeSubscription({
      amountPaid: 12_000,
      cancelAtDaysFromNow: 21,
      interval: "year",
      periodStartDaysAgo: 40,
      subscribedDaysAgo: 405,
    });

    await subscribedLearner({ refunded: 10_000, subscription });

    await expect(getWebPlusCancellation()).resolves.toMatchObject({
      extraordinary: { owed: 10_658, refundAmount: 658 },
    });

    await cancelWebPlus({
      locale: "en",
      request: { choice: "extraordinary", reason: "My school now pays for another tool" },
    });

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 658 }),
      expect.anything(),
    );
  });

  describe("without logging in", () => {
    it("withdraws by email alone and confirms to the account's own address", async () => {
      const subscription = stripeSubscription({
        amountPaid: 999,
        interval: "month",
        periodStartDaysAgo: 3,
        subscribedDaysAgo: 3,
      });

      const user = await subscribedLearner({ subscription });
      vi.mocked(getSession).mockResolvedValue(null);

      const answer = await requestWebPlusCancellation({
        email: ` ${user.email.toUpperCase()} `,
        locale: "de",
        name: "Erika Mustermann",
        request: { choice: "withdrawal" },
      });

      expect(answer).toStrictEqual({ receivedAt: expect.any(Date) });

      expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ amount: 999 }),
        expect.anything(),
      );

      expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, { prorate: false });

      expect(sendPlusCancellationEmail).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          choice: "withdrawal",
          email: user.email,
          lateWithdrawal: false,
          locale: "de",
          name: "Erika Mustermann",
          receivedAt: answer?.receivedAt,
        }),
      );
    });

    it("answers the same and does nothing for an email without an account", async () => {
      const answer = await requestWebPlusCancellation({
        email: `nobody-${randomUUID()}@zoonk.test`,
        locale: "en",
        name: "Nobody",
        request: { choice: "withdrawal" },
      });

      expect(answer).toStrictEqual({ receivedAt: expect.any(Date) });
      expect(stripe.retrieve).not.toHaveBeenCalled();
      expect(sendPlusCancellationEmail).not.toHaveBeenCalled();
    });

    it("takes a withdrawal after its 14 days as stopping the renewal", async () => {
      const subscription = stripeSubscription({
        amountPaid: 999,
        interval: "month",
        periodStartDaysAgo: 20,
        subscribedDaysAgo: 20,
      });

      const user = await subscribedLearner({ subscription });

      await requestWebPlusCancellation({
        email: user.email,
        locale: "en",
        name: user.name,
        request: { choice: "withdrawal" },
      });

      expect(stripe.refund).not.toHaveBeenCalled();

      expect(stripe.update).toHaveBeenCalledExactlyOnceWith(subscription.id, {
        cancel_at_period_end: true,
      });

      expect(sendPlusCancellationEmail).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ choice: "withdrawal", lateWithdrawal: true, refund: null }),
      );
    });

    it("only confirms a cancellation when the renewal is already stopped", async () => {
      const subscription = stripeSubscription({
        amountPaid: 999,
        cancelAtPeriodEnd: true,
        interval: "month",
        periodStartDaysAgo: 20,
        subscribedDaysAgo: 50,
      });

      const user = await subscribedLearner({ subscription });

      await requestWebPlusCancellation({
        email: user.email,
        locale: "en",
        name: user.name,
        request: { choice: "ordinary" },
      });

      expect(stripe.update).not.toHaveBeenCalled();
      expect(stripe.cancel).not.toHaveBeenCalled();

      expect(sendPlusCancellationEmail).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          choice: "ordinary",
          endsAt: new Date(subscription.items.data[0]!.current_period_end * 1000),
          refund: null,
        }),
      );
    });

    it("fails out loud when Stripe does, so sending it again finishes the job", async () => {
      const subscription = stripeSubscription({
        amountPaid: 999,
        interval: "month",
        periodStartDaysAgo: 3,
        subscribedDaysAgo: 3,
      });

      const user = await subscribedLearner({ subscription });

      const declaration = {
        email: user.email,
        locale: "en",
        name: user.name,
        request: { choice: "withdrawal" as const },
      };

      stripe.cancel.mockRejectedValueOnce(new Error("Stripe is down"));

      await expect(requestWebPlusCancellation(declaration)).rejects.toThrow("Stripe is down");
      expect(sendPlusCancellationEmail).not.toHaveBeenCalled();

      stripe.paymentIntent.mockResolvedValue({ latest_charge: { amount_refunded: 999 } });
      await requestWebPlusCancellation(declaration);

      expect(stripe.refund).toHaveBeenCalledOnce();
      expect(stripe.cancel).toHaveBeenCalledTimes(2);
      expect(sendPlusCancellationEmail).toHaveBeenCalledOnce();
    });

    it("takes nothing from a request that fails the human check", async () => {
      vi.mocked(isHumanRequest).mockResolvedValue(false);

      await expect(
        requestWebPlusCancellation({
          email: "someone@zoonk.test",
          locale: "en",
          name: "Someone",
          request: { choice: "ordinary" },
        }),
      ).resolves.toBeNull();

      expect(sendPlusCancellationEmail).not.toHaveBeenCalled();
    });
  });
});
