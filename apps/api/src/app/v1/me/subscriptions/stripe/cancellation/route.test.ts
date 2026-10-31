import {
  stripeSubscriptionCancellationReceiptSchema,
  stripeSubscriptionCancellationSchema,
} from "@/lib/openapi/schemas/subscriptions";
import {
  cancelWebPlus,
  getWebPlusCancellation,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as cancel, GET as preview } from "./route";

vi.mock("@zoonk/core/subscriptions/web-plus-cancellation", () => ({
  cancelWebPlus: vi.fn(),
  getWebPlusCancellation: vi.fn(),
}));

// next-intl reads the request's language from Next's request scope, which a route test lacks.
vi.mock("next-intl/server", () => ({ getLocale: async () => "de" }));

function cancelRequest(body: unknown) {
  return new NextRequest("http://localhost/v1/me/subscriptions/stripe/cancellation", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

describe("GET /v1/me/subscriptions/stripe/cancellation", () => {
  it("answers both choices in the documented shape, in major units", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({
      cancellation: {
        endsAt: new Date("2026-12-01T00:00:00Z"),
        refundAmount: 0,
        unstartedMonths: 0,
      },
      currency: "brl",
      email: "learner@example.test",
      endingAt: null,
      interval: "month",
      name: "Ana",
      status: "ready",
      unpaid: false,
      withdrawal: { refundAmount: 2990, until: new Date("2026-11-14T00:00:00Z") },
    });

    const response = await preview();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);

    expect(stripeSubscriptionCancellationSchema.strict().parse(body)).toStrictEqual({
      cancellation: { endsAt: "2026-12-01T00:00:00.000Z", refund: null },
      withdrawal: { refund: { amount: 29.9, currency: "BRL" }, until: "2026-11-14T00:00:00.000Z" },
    });
  });

  it("says there's nothing to cancel for a store subscription or one already ending", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({ provider: "apple", status: "store" });
    const store = await preview();

    vi.mocked(getWebPlusCancellation).mockResolvedValue({
      endsAt: new Date("2026-12-01T00:00:00Z"),
      status: "ending",
    });

    const ending = await preview();

    expect([store.status, ending.status]).toStrictEqual([404, 404]);
  });

  it("asks for a session", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue(null);
    const response = await preview();

    expect(response.status).toBe(401);
  });
});

describe("POST /v1/me/subscriptions/stripe/cancellation", () => {
  it("answers the receipt in the documented shape and emails it in the request's language", async () => {
    vi.mocked(cancelWebPlus).mockResolvedValue({
      endsAt: new Date("2026-11-03T10:00:00Z"),
      receivedAt: new Date("2026-11-03T10:00:00Z"),
      refund: { amount: 1000, currency: "jpy" },
      refundableUntil: null,
      status: "canceled",
    });

    const response = await cancel(cancelRequest({ withdraw: true }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(cancelWebPlus).toHaveBeenCalledExactlyOnceWith({ locale: "de", withdraw: true });

    expect(stripeSubscriptionCancellationReceiptSchema.strict().parse(body)).toStrictEqual({
      endsAt: "2026-11-03T10:00:00.000Z",
      receivedAt: "2026-11-03T10:00:00.000Z",
      refund: { amount: 1000, currency: "JPY" },
    });
  });

  it("refuses a choice that's no longer open", async () => {
    vi.mocked(cancelWebPlus).mockResolvedValue({ status: "unavailable" });

    const response = await cancel(cancelRequest({ withdraw: true }));

    expect(response.status).toBe(409);
  });

  it("refuses a request without the choice", async () => {
    const response = await cancel(cancelRequest({}));

    expect(response.status).toBe(400);
    expect(cancelWebPlus).not.toHaveBeenCalled();
  });
});
