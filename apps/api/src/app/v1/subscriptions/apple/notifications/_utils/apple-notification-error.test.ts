import { AppleStoreError } from "@zoonk/core/subscriptions/apple-store-error";
import { describe, expect, it } from "vitest";
import { getAppleNotificationErrorResponse } from "./apple-notification-error";

describe(getAppleNotificationErrorResponse, () => {
  it("acknowledges permanently invalid provider notifications without asking Apple to retry", async () => {
    const response = getAppleNotificationErrorResponse(new AppleStoreError("invalidTransaction"));

    expect(response?.status).toBe(204);
    await expect(response?.text()).resolves.toBe("");
  });

  it("keeps provider outages retryable through a server error", () => {
    expect(getAppleNotificationErrorResponse(new AppleStoreError("unavailable"))).toBeNull();
  });
});
