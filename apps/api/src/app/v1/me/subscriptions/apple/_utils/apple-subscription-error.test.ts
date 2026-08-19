import { AppleSubscriptionError } from "@zoonk/core/subscriptions/apple-sync";
import { describe, expect, it } from "vitest";
import { getAppleSubscriptionErrorResponse } from "./apple-subscription-error";

async function getErrorCode(response: Response) {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

describe(getAppleSubscriptionErrorResponse, () => {
  it("maps an account-bound purchase conflict to a stable client response", async () => {
    const response = getAppleSubscriptionErrorResponse(
      new AppleSubscriptionError("accountMismatch"),
    );

    expect(response?.status).toBe(409);
    await expect(getErrorCode(response as Response)).resolves.toBe("APPLE_ACCOUNT_MISMATCH");
  });

  it("keeps provider outages retryable through the shared internal boundary", () => {
    expect(getAppleSubscriptionErrorResponse(new AppleSubscriptionError("unavailable"))).toBeNull();
  });
});
