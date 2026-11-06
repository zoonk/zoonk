import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { getActiveSubscription } from "../auth/subscription";
import { getSession } from "../users/get-session";
import { getWebPlusSubscription } from "./get-web-plus-subscription";

const stripe = vi.hoisted(() => ({
  retrieve: vi.fn().mockRejectedValue(new Error("Stripe is down")),
}));

// Display reads must still work when the external billing service is unavailable.
vi.mock("@zoonk/auth/stripe-client", () => ({
  stripeClient: { subscriptions: { retrieve: stripe.retrieve } },
}));

describe.each(["apple", "google"] as const)(
  "website billing alongside a newer %s purchase",
  (provider) => {
    it.each(["active", "past_due", "unpaid"])(
      "returns the saved %s website plan without asking Stripe",
      async (status) => {
        const user = await userFixture();
        vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

        const website = await prisma.subscription.create({
          data: {
            periodEnd: new Date(Date.now() + 86_400_000),
            plan: "plus",
            provider: "stripe",
            referenceId: user.id,
            status,
            stripeSubscriptionId: `sub_${randomUUID()}`,
          },
        });

        const store = await prisma.subscription.create({
          data: {
            periodEnd: new Date(Date.now() + 86_400_000),
            plan: "plus",
            provider,
            providerSubscriptionId: randomUUID(),
            referenceId: user.id,
            status: "active",
            userId: user.id,
          },
        });

        await expect(getActiveSubscription()).resolves.toStrictEqual(store);

        await expect(getWebPlusSubscription()).resolves.toStrictEqual({
          periodEnd: status === "active" ? website.periodEnd : null,
          state: status === "active" ? "renewing" : "unpaid",
          status: "ready",
        });

        expect(stripe.retrieve).not.toHaveBeenCalled();
      },
    );
  },
);

describe(getWebPlusSubscription, () => {
  it("keeps a saved ending website plan resumable alongside a store purchase", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const subscription = await prisma.subscription.create({
      data: {
        cancelAtPeriodEnd: true,
        periodEnd: new Date(Date.now() + 86_400_000),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    await prisma.subscription.create({
      data: {
        periodEnd: new Date(Date.now() + 86_400_000),
        plan: "plus",
        provider: "apple",
        providerSubscriptionId: randomUUID(),
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    await expect(getWebPlusSubscription()).resolves.toStrictEqual({
      periodEnd: subscription.periodEnd,
      state: "ending",
      status: "ready",
    });

    expect(stripe.retrieve).not.toHaveBeenCalled();
  });

  it("reports the saved cancellation date as the end of an ending plan", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
    const cancelAt = new Date(Date.now() + 43_200_000);

    await prisma.subscription.create({
      data: {
        cancelAt,
        periodEnd: new Date(Date.now() + 86_400_000),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    await expect(getWebPlusSubscription()).resolves.toStrictEqual({
      periodEnd: cancelAt,
      state: "ending",
      status: "ready",
    });

    expect(stripe.retrieve).not.toHaveBeenCalled();
  });

  it("reads a free learner's website state without writing", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(countDatabaseStatements(getWebPlusSubscription)).resolves.toMatchObject({
      result: { status: "none" },
      writes: 0,
    });
  });

  it("prefers an older active website plan over a newer unpaid renewal", async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const active = await prisma.subscription.create({
      data: {
        periodEnd: new Date(Date.now() + 86_400_000),
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "active",
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    await prisma.subscription.create({
      data: {
        plan: "plus",
        provider: "stripe",
        referenceId: user.id,
        status: "past_due",
        stripeSubscriptionId: `sub_${randomUUID()}`,
      },
    });

    await expect(countDatabaseStatements(getWebPlusSubscription)).resolves.toMatchObject({
      result: { periodEnd: active.periodEnd, state: "renewing", status: "ready" },
      writes: 0,
    });
  });

  it("does not read a website subscription for a visitor or guest", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    await expect(countDatabaseStatements(getWebPlusSubscription)).resolves.toMatchObject({
      result: null,
      statements: 0,
      writes: 0,
    });

    const user = { ...(await userFixture()), isAnonymous: true };
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(countDatabaseStatements(getWebPlusSubscription)).resolves.toMatchObject({
      result: { status: "none" },
      statements: 0,
      writes: 0,
    });
  });
});
