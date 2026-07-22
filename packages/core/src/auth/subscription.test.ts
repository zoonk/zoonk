import { describe, expect, it, vi } from "vitest";
import { getActiveSubscription } from "./subscription";

const { listActiveSubscriptions } = vi.hoisted(() => ({ listActiveSubscriptions: vi.fn() }));

vi.mock("@zoonk/auth", () => ({ auth: { api: { listActiveSubscriptions } } }));

describe(getActiveSubscription, () => {
  it("treats subscription lookup failures as no active subscription", async () => {
    const lookupError = new Error("Subscription lookup failed");
    listActiveSubscriptions.mockRejectedValueOnce(lookupError);

    await expect(getActiveSubscription(new Headers())).resolves.toBeNull();
  });
});
