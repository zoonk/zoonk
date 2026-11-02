import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";
import { describe, expect, it } from "vitest";
import { getGooglePlaySubscriptionErrorResponse } from "./google-play-subscription-error";

async function getErrorCode(response: Response) {
  const body = (await response.json()) as { error: { code: string } };
  return body.error.code;
}

describe(getGooglePlaySubscriptionErrorResponse, () => {
  it("maps a purchase made for another account to a stable client response", async () => {
    const response = getGooglePlaySubscriptionErrorResponse(new GooglePlayError("accountMismatch"));

    expect(response?.status).toBe(409);
    await expect(getErrorCode(response as Response)).resolves.toBe("GOOGLE_PLAY_ACCOUNT_MISMATCH");
  });

  it.each(["invalidPurchase", "ended"] as const)(
    "refuses a purchase Google can't verify (%s) as invalid",
    async (reason) => {
      const response = getGooglePlaySubscriptionErrorResponse(new GooglePlayError(reason));

      expect(response?.status).toBe(400);

      await expect(getErrorCode(response as Response)).resolves.toBe(
        "GOOGLE_PLAY_PURCHASE_INVALID",
      );
    },
  );

  it("keeps provider outages retryable through the shared internal boundary", () => {
    expect(getGooglePlaySubscriptionErrorResponse(new GooglePlayError("unavailable"))).toBeNull();
  });
});
