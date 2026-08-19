import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getActiveSubscription, hasActiveSubscription } from "./subscription";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/**
 * Authenticates one fixture user so subscription reads exercise the same
 * identity boundary used by web and API callers.
 */
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
        referenceId: user.id,
        status: "active",
        userId: user.id,
      },
    });

    await expect(getActiveSubscription()).resolves.toBeNull();
    await expect(hasActiveSubscription()).resolves.toBe(false);
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
