import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sendEmail } from "@zoonk/mailer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guestAuth, signUp } from "../guests/_test-utils/guest-auth";
import { createCertificate } from "../guests/_test-utils/learner-data";
import pt from "../translations/pt.json";
import { endWebPlusBesideStorePlus } from "./settle-web-plus";
import type Stripe from "stripe";

vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

const DAY_MS = 86_400_000;
const CUSTOMER = "cus_plus";

const stripe = vi.hoisted(() => ({
  cancel: vi.fn(),
  checkout: vi.fn(),
  constructEvent: vi.fn(),
  createCustomer: vi.fn(),
  createPreview: vi.fn(),
  list: vi.fn(),
  listPrices: vi.fn(),
  paymentIntent: vi.fn(),
  refund: vi.fn(),
  retrieve: vi.fn(),
  retrieveCheckout: vi.fn(),
  retrieveInvoice: vi.fn(),
  searchCustomers: vi.fn(),
  voidInvoice: vi.fn(),
}));

// Stripe and the mailer are external services; the learner's subscription rows are real.
vi.mock("./client", () => ({
  stripeClient: {
    checkout: { sessions: { create: stripe.checkout, retrieve: stripe.retrieveCheckout } },
    customers: { create: stripe.createCustomer, search: stripe.searchCustomers },
    invoices: {
      createPreview: stripe.createPreview,
      retrieve: stripe.retrieveInvoice,
      voidInvoice: stripe.voidInvoice,
    },
    paymentIntents: { retrieve: stripe.paymentIntent },
    prices: { list: stripe.listPrices },
    refunds: { create: stripe.refund },
    subscriptions: { cancel: stripe.cancel, list: stripe.list, retrieve: stripe.retrieve },
    webhooks: { constructEventAsync: stripe.constructEvent },
  },
}));

vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn().mockResolvedValue({ error: null }) }));

type Billed = { customer: string; refunded: number; status: Stripe.Subscription.Status };

/** Stripe's side of a learner's website subscriptions: refunds and cancels change what it reads next. */
function fakeStripe() {
  const subscriptions = new Map<string, Billed>();
  const now = Math.floor(Date.now() / 1000);

  const read = (id: string) => {
    const { customer, status } = subscriptions.get(id) ?? {
      customer: CUSTOMER,
      status: "canceled",
    };

    return {
      cancel_at: null,
      cancel_at_period_end: false,
      canceled_at: status === "canceled" ? now : null,
      customer,
      ended_at: status === "canceled" ? now : null,
      id,
      items: {
        data: [
          {
            current_period_end: now + 30 * 86_400,
            current_period_start: now,
            id: `si_${id}`,
            price: {
              id: "price_plus",
              lookup_key: "plus_monthly",
              recurring: { interval: "month" },
            },
          },
        ],
      },
      latest_invoice: {
        amount_paid: status === "past_due" ? 0 : 999,
        currency: "eur",
        id: `in_${id}`,
        payments: { data: [{ payment: { payment_intent: `pi_${id}` }, status: "paid" }] },
        status: status === "past_due" ? "open" : "paid",
      },
      metadata: { locale: "pt" },
      start_date: now,
      status,
    } as unknown as Stripe.Subscription;
  };

  const byPaymentIntent = (paymentIntent: string) => {
    const id = paymentIntent.replace(/^pi_/u, "");
    return { id, state: subscriptions.get(id) };
  };

  stripe.list.mockImplementation(async ({ customer }: { customer: string }) => ({
    data: [...subscriptions.entries()]
      .filter(([, billed]) => billed.customer === customer && billed.status !== "canceled")
      .map(([id]) => read(id)),
  }));

  stripe.retrieve.mockImplementation(async (id: string) => read(id));

  stripe.paymentIntent.mockImplementation(async (paymentIntent: string) => ({
    latest_charge: { amount_refunded: byPaymentIntent(paymentIntent).state?.refunded ?? 0 },
  }));

  stripe.refund.mockImplementation(
    async ({ amount, payment_intent }: { amount: number; payment_intent: string }) => {
      const { state } = byPaymentIntent(payment_intent);

      if (state) {
        state.refunded += amount;
      }

      return { id: `re_${payment_intent}`, status: "succeeded" };
    },
  );

  stripe.cancel.mockImplementation(async (id: string) => {
    const state = subscriptions.get(id);

    if (state) {
      state.status = "canceled";
    }

    return read(id);
  });

  return {
    add(status: Stripe.Subscription.Status, customer = CUSTOMER) {
      const id = `sub_${randomUUID()}`;
      subscriptions.set(id, { customer, refunded: 0, status });
      return id;
    },
    read,
  };
}

async function learner() {
  const { headers, userId } = await signUp({ email: `plus-${randomUUID()}@example.test` });
  await prisma.user.update({ data: { stripeCustomerId: CUSTOMER }, where: { id: userId } });
  return { headers, userId };
}

function addStorePlus({
  periodEnd = new Date(Date.now() + 30 * DAY_MS),
  provider = "apple",
  userId,
}: {
  periodEnd?: Date;
  provider?: "apple" | "google";
  userId: string;
}) {
  return prisma.subscription.create({
    data: {
      periodEnd,
      plan: "plus",
      provider,
      providerSubscriptionId: randomUUID(),
      referenceId: userId,
      status: "active",
      userId,
    },
  });
}

/** Better Auth saves this row when a checkout starts, while the learner is free. */
function addCheckoutRow(userId: string) {
  return prisma.subscription.create({
    data: { plan: "plus", referenceId: userId, status: "incomplete", stripeCustomerId: CUSTOMER },
  });
}

function deliverStripeEvent(event: { data: { object: unknown }; type: string }) {
  stripe.constructEvent.mockResolvedValue(event);

  return guestAuth.handler(
    new Request("http://localhost:3000/api/auth/stripe/webhook", {
      body: "{}",
      headers: { "stripe-signature": "signed" },
      method: "POST",
    }),
  );
}

/** Stripe delivers the event that Checkout completed, as it may more than once. */
function deliverCheckoutCompleted({
  customer = CUSTOMER,
  rowId,
  subscriptionId,
  userId,
}: {
  customer?: string;
  rowId: string;
  subscriptionId: string;
  userId: string;
}) {
  return deliverStripeEvent({
    data: {
      object: {
        client_reference_id: userId,
        customer,
        metadata: { referenceId: userId, subscriptionId: rowId, userId },
        mode: "subscription",
        subscription: subscriptionId,
      },
    },
    type: "checkout.session.completed",
  });
}

function returnFromCheckout(headers: Headers) {
  return guestAuth.handler(
    new Request(
      "http://localhost:3000/api/auth/subscription/success?callbackURL=%2F&checkoutSessionId=cs_plus",
      { headers },
    ),
  );
}

function sentSubjects() {
  return vi.mocked(sendEmail).mock.calls.map(([email]) => email.subject);
}

describe("one Plus per learner on the website", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refunds and ends a checkout that completes after a store purchase, once across deliveries", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const row = await addCheckoutRow(userId);
    await addStorePlus({ userId });
    const subscriptionId = stripeFake.add("active");
    const delivery = { rowId: row.id, subscriptionId, userId };

    const first = await deliverCheckoutCompleted(delivery);
    const again = await deliverCheckoutCompleted(delivery);

    expect([first.status, again.status]).toStrictEqual([200, 200]);

    expect(stripe.refund).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ amount: 999, payment_intent: `pi_${subscriptionId}` }),
      expect.anything(),
    );

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscriptionId, expect.anything());

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled" });

    // The learner hears why, in the language they bought in, and never gets a purchase receipt.
    expect(sentSubjects()).toStrictEqual([pt.plusAlreadyActiveSubject]);
    expect(stripe.createPreview).not.toHaveBeenCalled();
  });

  it("fails the webhook while Stripe can't refund, so its next delivery finishes", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const row = await addCheckoutRow(userId);
    await addStorePlus({ userId });
    const subscriptionId = stripeFake.add("active");
    const delivery = { rowId: row.id, subscriptionId, userId };

    stripe.refund.mockRejectedValueOnce(new Error("Stripe is down"));

    const failed = await deliverCheckoutCompleted(delivery);

    expect(failed.status).toBe(400);
    expect(stripe.cancel).not.toHaveBeenCalled();

    const retried = await deliverCheckoutCompleted(delivery);

    expect(retried.status).toBe(200);
    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscriptionId, expect.anything());
    expect(sentSubjects()).toStrictEqual([pt.plusAlreadyActiveSubject]);
  });

  it("saves a checkout as ended when store Plus ends it before Better Auth saves it", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const row = await addCheckoutRow(userId);
    await addStorePlus({ userId });
    const subscriptionId = stripeFake.add("active");

    // Better Auth reads the checkout's subscription while active. Before it saves that, the store
    // purchase's follow-up ends it, and Stripe's deletion arrives while no row names it yet.
    stripe.retrieve.mockImplementationOnce(async (id: string) => {
      const active = stripeFake.read(id);
      await endWebPlusBesideStorePlus({ userId });

      await deliverStripeEvent({
        data: { object: stripeFake.read(id) },
        type: "customer.subscription.deleted",
      });

      return active;
    });

    const completed = await deliverCheckoutCompleted({ rowId: row.id, subscriptionId, userId });

    expect(completed.status).toBe(200);
    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscriptionId, expect.anything());

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled", stripeSubscriptionId: subscriptionId });
  });

  it("saves a checkout as ended when store Plus ends it before the page Stripe returns to saves it", async () => {
    const stripeFake = fakeStripe();
    const { headers, userId } = await learner();
    const row = await addCheckoutRow(userId);
    await addStorePlus({ userId });
    const subscriptionId = stripeFake.add("active");

    stripe.retrieveCheckout.mockImplementation(
      async (id: string, params?: { expand?: string[] }) => ({
        id,
        metadata: { referenceId: userId, subscriptionId: row.id },
        payment_status: "paid",
        subscription: params?.expand?.includes("subscription")
          ? stripeFake.read(subscriptionId)
          : subscriptionId,
      }),
    );

    // The page reads the subscription while active. Before it saves that, the store purchase's
    // follow-up ends it and every webhook Stripe sends about it is handled.
    stripe.retrieve.mockImplementationOnce(async (id: string) => {
      const active = stripeFake.read(id);
      await endWebPlusBesideStorePlus({ userId });

      await deliverStripeEvent({
        data: { object: stripeFake.read(id) },
        type: "customer.subscription.deleted",
      });

      await deliverCheckoutCompleted({ rowId: row.id, subscriptionId, userId });
      return active;
    });

    const returned = await returnFromCheckout(headers);

    expect(returned.status).toBe(302);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled" });
  });

  it("keeps website Plus ended when Stripe's update from before the end arrives after it", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const subscriptionId = stripeFake.add("active");
    const active = stripeFake.read(subscriptionId);

    const row = await prisma.subscription.create({
      data: {
        plan: "plus",
        referenceId: userId,
        status: "active",
        stripeCustomerId: CUSTOMER,
        stripeSubscriptionId: subscriptionId,
      },
    });

    await addStorePlus({ userId });
    await endWebPlusBesideStorePlus({ userId });

    // A subscription made in Stripe's dashboard names no learner or row.
    const late = await deliverStripeEvent({
      data: { object: active },
      type: "customer.subscription.updated",
    });

    expect(late.status).toBe(200);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled" });
  });

  it("ends website Plus under each Stripe customer two checkouts started at once made", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    await addStorePlus({ userId });
    const otherRow = await addCheckoutRow(userId);

    await prisma.subscription.update({
      data: { stripeCustomerId: "cus_other" },
      where: { id: otherRow.id },
    });

    const first = stripeFake.add("active");
    const second = stripeFake.add("active", "cus_other");

    await expect(endWebPlusBesideStorePlus({ userId })).resolves.toHaveLength(2);

    expect(stripe.cancel).toHaveBeenCalledTimes(2);
    expect(stripe.cancel).toHaveBeenCalledWith(first, expect.anything());
    expect(stripe.cancel).toHaveBeenCalledWith(second, expect.anything());
  });

  it("ends a completed checkout under a customer none of the learner's rows keeps", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const row = await addCheckoutRow(userId);
    await addStorePlus({ userId });

    // Two checkouts started at once; the row kept the other one's customer.
    const subscriptionId = stripeFake.add("active", "cus_lost");
    await deliverCheckoutCompleted({ customer: "cus_lost", rowId: row.id, subscriptionId, userId });

    expect(stripe.cancel).toHaveBeenCalledExactlyOnceWith(subscriptionId, expect.anything());
  });

  it("still tells the learner about an ended subscription when ending another fails", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    await addStorePlus({ userId });
    stripeFake.add("active");
    stripeFake.add("active");

    stripe.refund.mockRejectedValueOnce(new Error("Stripe is down"));

    await expect(endWebPlusBesideStorePlus({ userId })).rejects.toThrow("Stripe is down");
    expect(sentSubjects()).toStrictEqual([pt.plusAlreadyActiveSubject]);
  });

  it("saves a subscription Stripe ended, failing the webhook until it's saved", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const subscriptionId = stripeFake.add("canceled");

    const row = await prisma.subscription.create({
      data: {
        plan: "plus",
        referenceId: userId,
        status: "active",
        stripeSubscriptionId: subscriptionId,
      },
    });

    const deleted = {
      data: { object: stripeFake.read(subscriptionId) },
      type: "customer.subscription.deleted",
    };

    // A database outage can't be produced safely, so one save of ours fails here.
    vi.spyOn(prisma.subscription, "updateMany").mockRejectedValueOnce(new Error("Database down"));

    const failed = await deliverStripeEvent(deleted);
    const retried = await deliverStripeEvent(deleted);

    expect([failed.status, retried.status]).toStrictEqual([400, 200]);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled" });
  });

  it("stops charging an unpaid website renewal once store Plus starts, with nothing to refund", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    await addStorePlus({ provider: "google", userId });
    stripeFake.add("past_due");

    await expect(endWebPlusBesideStorePlus({ userId })).resolves.toMatchObject([
      { keptStore: "google", refund: null },
    ]);

    expect(stripe.refund).not.toHaveBeenCalled();
    expect(stripe.voidInvoice).toHaveBeenCalledOnce();
    await expect(endWebPlusBesideStorePlus({ userId })).resolves.toStrictEqual([]);
  });

  it("leaves website Plus alone while the learner has no store Plus", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    await addStorePlus({ periodEnd: new Date(Date.now() - DAY_MS), userId });
    stripeFake.add("active");

    await expect(endWebPlusBesideStorePlus({ userId })).resolves.toStrictEqual([]);

    expect(stripe.list).not.toHaveBeenCalled();
    expect(stripe.cancel).not.toHaveBeenCalled();
  });

  it("starts a checkout in a row of its own, never a lapsed store subscription's", async () => {
    fakeStripe();
    const { headers, userId } = await learner();

    // Apple's expiry hasn't reached us, so the row still says active after its period.
    const lapsed = await addStorePlus({ periodEnd: new Date(Date.now() - DAY_MS), userId });

    stripe.searchCustomers.mockResolvedValue({ data: [] });
    stripe.createCustomer.mockResolvedValue({ id: CUSTOMER });
    stripe.listPrices.mockResolvedValue({ data: [{ id: "price_plus", recurring: {} }] });
    stripe.checkout.mockResolvedValue({ id: "cs_plus", url: "https://checkout.stripe.com/c/plus" });

    await guestAuth.api.upgradeSubscription({
      body: { cancelUrl: "/", locale: "en", plan: "plus", successUrl: "/" },
      headers,
    });

    const [[checkout]] = stripe.checkout.mock.calls as [[Stripe.Checkout.SessionCreateParams]];
    const rowId = String(checkout.subscription_data?.metadata?.subscriptionId);

    expect(rowId).not.toBe(lapsed.id);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: lapsed.id } }),
    ).resolves.toStrictEqual(lapsed);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: rowId } }),
    ).resolves.toMatchObject({ provider: "stripe", status: "incomplete" });
  });
});

function readIssuedAt(userId: string) {
  return prisma.certificate.findMany({ select: { issuedAt: true }, where: { userId } });
}

describe("certificates on a website purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues them on a paid checkout, even when a refund already ended our copy", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const [row] = await Promise.all([addCheckoutRow(userId), createCertificate({ userId })]);
    const subscriptionId = stripeFake.add("canceled");

    const delivered = await deliverStripeEvent({
      data: {
        object: {
          client_reference_id: userId,
          customer: CUSTOMER,
          metadata: { referenceId: userId, subscriptionId: row.id, userId },
          mode: "subscription",
          payment_status: "paid",
          subscription: subscriptionId,
        },
      },
      type: "checkout.session.completed",
    });

    expect(delivered.status).toBe(200);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ status: "canceled" });

    await expect(readIssuedAt(userId)).resolves.toStrictEqual([{ issuedAt: expect.any(Date) }]);
  });

  it("issues them when a subscription turns active, as after a failed payment is paid", async () => {
    const stripeFake = fakeStripe();
    const { userId } = await learner();
    const subscriptionId = stripeFake.add("active");

    await Promise.all([
      createCertificate({ userId }),
      prisma.subscription.create({
        data: {
          plan: "plus",
          referenceId: userId,
          status: "past_due",
          stripeCustomerId: CUSTOMER,
          stripeSubscriptionId: subscriptionId,
        },
      }),
    ]);

    const delivered = await deliverStripeEvent({
      data: { object: stripeFake.read(subscriptionId) },
      type: "customer.subscription.updated",
    });

    expect(delivered.status).toBe(200);
    await expect(readIssuedAt(userId)).resolves.toStrictEqual([{ issuedAt: expect.any(Date) }]);
  });

  it("issues them as the learner lands back from checkout, and never from someone else's", async () => {
    const stripeFake = fakeStripe();
    const [buyer, other] = await Promise.all([learner(), learner()]);
    const subscriptionId = stripeFake.add("active");

    const [row] = await Promise.all([
      addCheckoutRow(buyer.userId),
      createCertificate({ userId: buyer.userId }),
      createCertificate({ userId: other.userId }),
    ]);

    stripe.retrieveCheckout.mockImplementation(
      async (id: string, params?: { expand?: string[] }) => ({
        client_reference_id: buyer.userId,
        id,
        metadata: { referenceId: buyer.userId, subscriptionId: row.id },
        payment_status: "paid",
        subscription: params?.expand?.includes("subscription")
          ? stripeFake.read(subscriptionId)
          : subscriptionId,
      }),
    );

    await expect(returnFromCheckout(other.headers)).resolves.toMatchObject({ status: 302 });
    await expect(readIssuedAt(other.userId)).resolves.toStrictEqual([{ issuedAt: null }]);

    await expect(returnFromCheckout(buyer.headers)).resolves.toMatchObject({ status: 302 });

    await expect(readIssuedAt(buyer.userId)).resolves.toStrictEqual([
      { issuedAt: expect.any(Date) },
    ]);
  });
});
