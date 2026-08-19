import { AppleStoreError } from "@zoonk/core/subscriptions/apple-store-error";
import { describe, expect, it } from "vitest";
import { getAppleNotificationErrorResponse } from "./apple-notification-error";

async function getErrorCode(response: Response) {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

describe(getAppleNotificationErrorResponse, () => {
  it("rejects invalid provider notifications without asking Apple to retry", async () => {
    const response = getAppleNotificationErrorResponse(new AppleStoreError("invalidTransaction"));

    expect(response?.status).toBe(400);
    await expect(getErrorCode(response as Response)).resolves.toBe("APPLE_NOTIFICATION_INVALID");
  });

  it("keeps provider outages retryable through a server error", () => {
    expect(getAppleNotificationErrorResponse(new AppleStoreError("unavailable"))).toBeNull();
  });
});
