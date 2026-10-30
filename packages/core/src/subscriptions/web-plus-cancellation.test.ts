import { NativeAuthResponseError } from "@zoonk/auth/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWebPlusCancellation } from "./web-plus-cancellation";

const mocks = vi.hoisted(() => ({
  cancelSubscription: vi.fn(),
  getRequestHeaders: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@zoonk/auth", () => ({ auth: { api: { cancelSubscription: mocks.cancelSubscription } } }));
vi.mock("next/headers", () => ({ headers: mocks.getRequestHeaders }));
vi.mock("../users/get-session", () => ({ getSession: mocks.getSession }));

describe(createWebPlusCancellation, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequestHeaders.mockResolvedValue(new Headers({ authorization: "Bearer token" }));
    mocks.getSession.mockResolvedValue({ user: { id: "learner" } });
  });

  it("asks nothing of Stripe without a session", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(createWebPlusCancellation()).resolves.toBeNull();
    expect(mocks.cancelSubscription).not.toHaveBeenCalled();
  });

  it("opens Stripe's cancellation, which returns to main's subscription page", async () => {
    mocks.cancelSubscription.mockResolvedValue({
      redirect: false,
      url: "https://billing.stripe.com/p/session/cancel",
    });

    await expect(createWebPlusCancellation()).resolves.toStrictEqual({
      status: "ready",
      url: "https://billing.stripe.com/p/session/cancel",
    });

    expect(mocks.cancelSubscription).toHaveBeenCalledExactlyOnceWith({
      body: { disableRedirect: true, returnUrl: expect.stringMatching(/\/subscription$/u) },
      headers: expect.any(Headers),
    });
  });

  it("says there's nothing to cancel without an active Stripe subscription", async () => {
    mocks.cancelSubscription.mockRejectedValue(
      new NativeAuthResponseError({
        body: { code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found" },
        statusCode: 400,
      }),
    );

    await expect(createWebPlusCancellation()).resolves.toStrictEqual({ status: "none" });
  });

  it("lets other failures through", async () => {
    mocks.cancelSubscription.mockRejectedValue(new Error("Stripe is down"));

    await expect(createWebPlusCancellation()).rejects.toThrow("Stripe is down");
  });
});
