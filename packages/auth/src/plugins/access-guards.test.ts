import { describe, expect, it, vi } from "vitest";
import { guestAuth, signInAsGuest } from "../guests/_test-utils/guest-auth";

/** Checkout must be blocked before any request reaches Stripe. */
const stripeMocks = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn() }));

vi.mock("../stripe/client", () => ({
  stripeClient: {
    checkout: { sessions: { create: stripeMocks.create } },
    customers: { create: stripeMocks.create, search: stripeMocks.search },
    prices: { list: stripeMocks.search },
  },
}));

const UPGRADE_BODY = { cancelUrl: "/", plan: "plus", successUrl: "/" };

describe("access guards", () => {
  it("asks guests to create an account before checkout", async () => {
    const { headers } = await signInAsGuest();

    await expect(
      guestAuth.api.upgradeSubscription({ body: UPGRADE_BODY, headers }),
    ).rejects.toMatchObject({ body: { code: "GUEST_PURCHASE_NOT_ALLOWED" }, statusCode: 403 });

    expect(stripeMocks.create).not.toHaveBeenCalled();
  });
});
