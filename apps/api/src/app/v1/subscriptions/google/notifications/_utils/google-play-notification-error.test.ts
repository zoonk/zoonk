import { GooglePlayError } from "@zoonk/core/subscriptions/google-play-error";
import { describe, expect, it } from "vitest";
import { getGooglePlayNotificationErrorResponse } from "./google-play-notification-error";

describe(getGooglePlayNotificationErrorResponse, () => {
  it("acknowledges a purchase Google no longer knows without asking Pub/Sub to retry", async () => {
    const response = getGooglePlayNotificationErrorResponse(new GooglePlayError("invalidPurchase"));

    expect(response?.status).toBe(204);
    await expect(response?.text()).resolves.toBe("");
  });

  it("refuses an unauthenticated push", () => {
    expect(
      getGooglePlayNotificationErrorResponse(new GooglePlayError("unauthorized"))?.status,
    ).toBe(401);
  });

  it("keeps configuration and provider failures retryable through a server error", () => {
    expect(getGooglePlayNotificationErrorResponse(new GooglePlayError("configuration"))).toBeNull();
    expect(getGooglePlayNotificationErrorResponse(new GooglePlayError("unavailable"))).toBeNull();
  });
});
