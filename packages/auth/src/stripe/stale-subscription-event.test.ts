import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveSubscriptionQuery } from "../active-subscription";
import { guestAuth, signUp } from "../guests/_test-utils/guest-auth";
import { type SubscriptionChange, registerSubscriptionChangeSink } from "./subscription-events";
import type Stripe from "stripe";

vi.hoisted(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

const stripe = vi.hoisted(() => ({ constructEvent: vi.fn(), retrieve: vi.fn() }));

// Stripe is an external service; the learner's subscription rows are real.
vi.mock("./client", () => ({
  stripeClient: {
    subscriptions: { retrieve: stripe.retrieve },
    webhooks: { constructEventAsync: stripe.constructEvent },
  },
}));

const now = Math.floor(Date.now() / 1000);

type State = { cancelAtPeriodEnd?: boolean; status: Stripe.Subscription.Status };

function stripeSubscription(id: string, { cancelAtPeriodEnd = false, status }: State) {
  return {
    cancel_at: null,
    cancel_at_period_end: cancelAtPeriodEnd,
    canceled_at: cancelAtPeriodEnd ? now : null,
    customer: `cus_${id}`,
    ended_at: null,
    id,
    items: {
      data: [
        {
          current_period_end: now + 30 * 86_400,
          current_period_start: now,
          id: `si_${id}`,
          price: { id: "price_plus", lookup_key: "plus_monthly", recurring: { interval: "month" } },
          quantity: 1,
        },
      ],
    },
    metadata: {},
    status,
    // Only the fields the webhook reads; Stripe's type requires dozens more.
  } as unknown as Stripe.Subscription;
}

function deliverUpdated(object: Stripe.Subscription) {
  stripe.constructEvent.mockResolvedValue({
    created: now,
    data: { object },
    type: "customer.subscription.updated",
  });

  return guestAuth.handler(
    new Request("http://localhost:3000/api/auth/stripe/webhook", {
      body: "{}",
      headers: { "stripe-signature": "signed" },
      method: "POST",
    }),
  );
}

/** A website subscriber whose row matches what Stripe holds now. */
async function subscriber(live: State) {
  const { userId } = await signUp({ email: `stale-${randomUUID()}@example.test` });
  const id = `sub_${randomUUID()}`;

  await prisma.subscription.create({
    data: {
      cancelAtPeriodEnd: live.cancelAtPeriodEnd ?? false,
      plan: "plus",
      referenceId: userId,
      status: live.status,
      stripeCustomerId: `cus_${id}`,
      stripeSubscriptionId: id,
    },
  });

  stripe.retrieve.mockResolvedValue(stripeSubscription(id, live));
  return { id, userId };
}

async function hasPlus(userId: string) {
  const plus = await prisma.subscription.findFirst(
    getActiveSubscriptionQuery({ now: new Date(), userId }),
  );

  return plus !== null;
}

function savedRow(id: string) {
  return prisma.subscription.findFirstOrThrow({ where: { stripeSubscriptionId: id } });
}

const reported = vi.fn(async (_change: SubscriptionChange) => {});

describe("a Stripe subscription update delivered after a newer one", () => {
  beforeEach(() => {
    reported.mockClear();
    registerSubscriptionChangeSink(reported);
  });

  it("keeps Plus off a renewal Stripe couldn't charge when the older 'active' arrives", async () => {
    const { id, userId } = await subscriber({ status: "past_due" });

    const response = await deliverUpdated(stripeSubscription(id, { status: "active" }));

    expect(response.status).toBe(200);
    await expect(savedRow(id)).resolves.toMatchObject({ status: "past_due" });
    await expect(hasPlus(userId)).resolves.toBe(false);
  });

  it("keeps Plus for a learner who paid after a failed renewal when the older 'past_due' arrives", async () => {
    const { id, userId } = await subscriber({ status: "active" });

    const response = await deliverUpdated(stripeSubscription(id, { status: "past_due" }));

    expect(response.status).toBe(200);
    await expect(savedRow(id)).resolves.toMatchObject({ status: "active" });
    await expect(hasPlus(userId)).resolves.toBe(true);
  });

  it("keeps Plus renewing and counts no cancel when the cancel arrives after the learner kept Plus", async () => {
    const { id } = await subscriber({ status: "active" });

    const response = await deliverUpdated(
      stripeSubscription(id, { cancelAtPeriodEnd: true, status: "active" }),
    );

    expect(response.status).toBe(200);
    await expect(savedRow(id)).resolves.toMatchObject({ cancelAtPeriodEnd: false });
    expect(reported).not.toHaveBeenCalled();
  });

  it("counts a cancel made in Stripe once its update arrives", async () => {
    const { id, userId } = await subscriber({ status: "active" });
    const canceled = stripeSubscription(id, { cancelAtPeriodEnd: true, status: "active" });
    stripe.retrieve.mockResolvedValue(canceled);

    const first = await deliverUpdated(canceled);
    const again = await deliverUpdated(canceled);

    expect([first.status, again.status]).toStrictEqual([200, 200]);
    await expect(savedRow(id)).resolves.toMatchObject({ cancelAtPeriodEnd: true });

    expect(reported).toHaveBeenCalledExactlyOnceWith({
      change: "canceled",
      plan: "plus",
      referenceId: userId,
    });
  });
});
