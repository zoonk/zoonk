import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sendEmail } from "@zoonk/mailer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestAuth, signUp } from "../guests/_test-utils/guest-auth";
import pt from "../translations/pt.json";
import { endWebPlusBesideStorePlus } from "./web-plus-beside-store";
import type Stripe from "stripe";

vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

const DAY_MS = 86_400_000;

const stripe = vi.hoisted(() => ({
  cancel: vi.fn(),
  constructEvent: vi.fn(),
  createPreview: vi.fn(),
  paymentIntent: vi.fn(),
  refund: vi.fn(),
  retrieve: vi.fn(),
  retrieveInvoice: vi.fn(),
  voidInvoice: vi.fn(),
}));

// Stripe and the mailer are external services; the learner's subscription rows are real.
vi.mock("./client", () => ({
  stripeClient: {
    invoices: {
      createPreview: stripe.createPreview,
      retrieve: stripe.retrieveInvoice,
      voidInvoice: stripe.voidInvoice,
    },
    paymentIntents: { retrieve: stripe.paymentIntent },
    refunds: { create: stripe.refund },
    subscriptions: { cancel: stripe.cancel, retrieve: stripe.retrieve },
    webhooks: { constructEventAsync: stripe.constructEvent },
  },
}));

vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue({ error: null }) }));

/** Stripe's side of one website subscription: canceling and refunding change what it reads next. */
function stripeSubscription({ status }: { status: Stripe.Subscription.Status }) {
  const now = Math.floor(Date.now() / 1000);
  const state = { refunded: 0, status };

  const read = () =>
    ({
      cancel_at: null,
      cancel_at_period_end: false,
      canceled_at: state.status === "canceled" ? now : null,
      ended_at: state.status === "canceled" ? now : null,
      id: `sub_${randomUUID()}`,
      items: {
        data: [
          {
            current_period_end: now + 30 * 86_400,
            current_period_start: now,
            id: "si_plus",
            price: {
              id: "price_plus",
              lookup_key: "plus_monthly",
              recurring: { interval: "month" },
            },
          },
        ],
      },
      latest_invoice: {
        amount_paid: status === "active" ? 999 : 0,
        currency: "eur",
        id: "in_plus",
        payments: { data: [{ payment: { payment_intent: "pi_plus" }, status: "paid" }] },
        status: status === "active" ? "paid" : "open",
      },
      metadata: { locale: "pt" },
      start_date: now,
      status: state.status,
    }) as unknown as Stripe.Subscription;

  const subscription = read();

  stripe.retrieve.mockImplementation(async () => ({ ...read(), id: subscription.id }));

  stripe.paymentIntent.mockImplementation(async () => ({
    latest_charge: { amount_refunded: state.refunded },
  }));

  stripe.refund.mockImplementation(async ({ amount }: { amount: number }) => {
    state.refunded += amount;
    return { id: "re_plus", status: "succeeded" };
  });

  stripe.cancel.mockImplementation(async () => {
    state.status = "canceled";
    return { ...read(), id: subscription.id };
  });

  return subscription;
}

async function learnerWithStorePlus(provider: "apple" | "google" = "apple") {
  const { userId } = await signUp({ email: `plus-${randomUUID()}@example.test` });

  await prisma.subscription.create({
    data: {
      periodEnd: new Date(Date.now() + 30 * DAY_MS),
      plan: "plus",
      provider,
      providerSubscriptionId: randomUUID(),
      referenceId: userId,
      status: "active",
      userId,
    },
  });

  return userId;
}

function addWebPlus({
  status,
  subscription,
  userId,
}: {
  status: string;
  subscription: Stripe.Subscription;
  userId: string;
}) {
  return prisma.subscription.create({
    data: {
      plan: "plus",
      referenceId: userId,
      status,
      stripeCustomerId: "cus_plus",
      stripeSubscriptionId: subscription.id,
    },
  });
}

/** Stripe delivers the event that Checkout completed, as it may more than once. */
function deliverCheckoutCompleted({
  subscription,
  subscriptionRowId,
  userId,
}: {
  subscription: Stripe.Subscription;
  subscriptionRowId: string;
  userId: string;
}) {
  stripe.constructEvent.mockResolvedValue({
    data: {
      object: {
        client_reference_id: userId,
        metadata: { referenceId: userId, subscriptionId: subscriptionRowId, userId },
        mode: "subscription",
        subscription: subscription.id,
      },
    },
    type: "checkout.session.completed",
  });

  return guestAuth.handler(
    new Request("http://localhost:3000/api/auth/stripe/webhook", {
      body: "{}",
      headers: { "stripe-signature": "signed" },
      method: "POST",
    }),
  );
}

describe("website Plus beside store Plus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refunds and ends a checkout that completes after a store purchase, once across deliveries", async () => {
    const userId = await learnerWithStorePlus();
    const subscription = stripeSubscription({ status: "active" });

    // The checkout opened while the learner was free, so Better Auth saved its row then.
    const row = await prisma.subscription.create({
      data: {
        plan: "plus",
        referenceId: userId,
        status: "incomplete",
        stripeCustomerId: "cus_plus",
      },
    });

    const delivery = { subscription, subscriptionRowId: row.id, userId };

    const deliveries = [
      await deliverCheckoutCompleted(delivery),
      await deliverCheckoutCompleted(delivery),
    ];

    expect(deliveries.map((response) => response.status)).toStrictEqual([200, 200]);

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 999, payment_intent: "pi_plus" }),
      expect.anything(),
    );

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscription.id, expect.anything());

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled" });

    // The learner hears why, in the language they bought in, and never gets a purchase receipt.
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ subject: pt.plusAlreadyActiveSubject }),
    );

    expect(stripe.createPreview).not.toHaveBeenCalled();
  });

  it("stops charging an unpaid website renewal once store Plus starts, with nothing to refund", async () => {
    const userId = await learnerWithStorePlus("google");
    const subscription = stripeSubscription({ status: "past_due" });
    await addWebPlus({ status: "past_due", subscription, userId });

    await expect(endWebPlusBesideStorePlus(userId)).resolves.toBe(true);

    expect(stripe.refund).not.toHaveBeenCalled();
    expect(stripe.cancel).toHaveBeenCalledOnce();
    expect(stripe.voidInvoice).toHaveBeenCalledExactlyOnceWith("in_plus");
    await expect(endWebPlusBesideStorePlus(userId)).resolves.toBe(false);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("leaves website Plus alone while the learner has no store Plus", async () => {
    const { userId } = await signUp({ email: `plus-${randomUUID()}@example.test` });
    const subscription = stripeSubscription({ status: "active" });
    await addWebPlus({ status: "active", subscription, userId });

    await expect(endWebPlusBesideStorePlus(userId)).resolves.toBe(false);

    expect(stripe.retrieve).not.toHaveBeenCalled();
    expect(stripe.cancel).not.toHaveBeenCalled();
  });
});
