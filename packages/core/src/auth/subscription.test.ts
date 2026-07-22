import { beforeEach, describe, expect, it, vi } from "vitest";
import { getActiveSubscription } from "./subscription";

const { listActiveSubscriptions } = vi.hoisted(() => ({ listActiveSubscriptions: vi.fn() }));

vi.mock("@zoonk/auth", () => ({ auth: { api: { listActiveSubscriptions } } }));

describe(getActiveSubscription, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats Better Auth's signed-out response as no subscription", async () => {
    const signedOutError = Object.assign(new Error("Unauthorized"), { status: "UNAUTHORIZED" });
    listActiveSubscriptions.mockRejectedValueOnce(signedOutError);

    await expect(getActiveSubscription(new Headers())).resolves.toBeNull();
  });

  it("does not turn provider failures into a cacheable missing subscription", async () => {
    const providerError = Object.assign(new Error("Subscription provider unavailable"), {
      statusCode: 401,
    });

    listActiveSubscriptions.mockRejectedValueOnce(providerError);

    await expect(getActiveSubscription(new Headers())).rejects.toBe(providerError);
  });
});
