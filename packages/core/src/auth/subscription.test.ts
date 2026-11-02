import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as nextCache from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getActiveSubscription, hasActiveSubscription } from "./subscription";

async function authenticateFixtureUser() {
  const user = await userFixture();
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

  return user;
}

describe(getActiveSubscription, () => {
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("returns null for a guest", async () => {
    await expect(getActiveSubscription()).resolves.toBeNull();
  });

  it("returns the current learner's active subscription", async () => {
    const user = await authenticateFixtureUser();

    const subscription = await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await expect(getActiveSubscription()).resolves.toMatchObject({
      id: subscription.id,
      plan: "plus",
      provider: "zoonk",
      referenceId: user.id,
      status: "active",
    });
  });

  it("accepts trialing subscriptions and ignores inactive subscriptions", async () => {
    const user = await authenticateFixtureUser();

    await Promise.all([
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "canceled" },
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "trialing" },
      }),
    ]);

    await expect(getActiveSubscription()).resolves.toMatchObject({
      referenceId: user.id,
      status: "trialing",
    });

    await expect(hasActiveSubscription()).resolves.toBe(true);
  });

  it("does not grant access after an Apple entitlement period expires", async () => {
    const user = await authenticateFixtureUser();

    await prisma.subscription.create({
      data: {
        periodEnd: new Date(Date.now() - 60_000),
        plan: "plus",
        provider: "apple",
        providerSubscriptionId: `expired-apple-${user.id}`,
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    await expect(getActiveSubscription()).resolves.toBeNull();
    await expect(hasActiveSubscription()).resolves.toBe(false);
  });

  it("checks Apple expiry at the request's instant, after an IO suspension", async () => {
    const user = await authenticateFixtureUser();
    const beforeRequest = new Date("2026-10-13T12:00:00Z");

    await prisma.subscription.create({
      data: {
        periodEnd: new Date("2026-10-13T12:01:00Z"),
        plan: "plus",
        provider: "apple",
        providerSubscriptionId: `request-apple-${user.id}`,
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    const entered = Promise.withResolvers<null>();
    const request = Promise.withResolvers<null>();

    const boundary = vi.spyOn(nextCache, "io").mockImplementationOnce(async () => {
      entered.resolve(null);
      await request.promise;
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(beforeRequest);

    try {
      const access = hasActiveSubscription();
      await Promise.race([entered.promise, access]);

      vi.setSystemTime(new Date("2026-10-13T12:02:00Z"));
      request.resolve(null);

      await expect(access).resolves.toBe(false);
    } finally {
      request.resolve(null);
      boundary.mockRestore();
      vi.useRealTimers();
    }
  });

  it("never returns another learner's subscription", async () => {
    const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: otherUser.id, status: "active" },
    });

    await expect(getActiveSubscription()).resolves.toBeNull();
    await expect(hasActiveSubscription()).resolves.toBe(false);
  });

  it("propagates subscription lookup failures", async () => {
    await authenticateFixtureUser();

    vi.spyOn(prisma.subscription, "findFirst").mockRejectedValueOnce(
      new Error("Subscription lookup failed"),
    );

    await expect(getActiveSubscription()).rejects.toThrow("Subscription lookup failed");
  });
});
