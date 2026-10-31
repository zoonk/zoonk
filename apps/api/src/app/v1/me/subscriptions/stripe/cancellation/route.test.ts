import {
  stripeSubscriptionCancellationReceiptSchema,
  stripeSubscriptionCancellationSchema,
} from "@/lib/openapi/schemas/subscriptions";
import {
  cancelWebPlus,
  getWebPlusCancellation,
  keepWebPlus,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as cancel, DELETE as keep, GET as preview } from "./route";

vi.mock("@zoonk/core/subscriptions/web-plus-cancellation", () => ({
  cancelWebPlus: vi.fn(),
  getWebPlusCancellation: vi.fn(),
  keepWebPlus: vi.fn(),
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
  it("answers the choices in the documented shape, in major units", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({
      accountDeletionRefund: 2990,
      canResumeRenewal: false,
      cancellation: {
        endsAt: new Date("2026-12-01T00:00:00Z"),
        refundAmount: 0,
        unstartedMonths: 0,
      },
      currency: "brl",
      email: "learner@example.test",
      endingAt: null,
      extraordinary: { owed: 2093, refundAmount: 2093 },
      interval: "month",
      name: "Ana",
      status: "ready",
      timeZone: "America/Sao_Paulo",
      unpaid: false,
      withdrawal: { refundAmount: 2990, until: new Date("2026-11-14T00:00:00Z") },
    });

    const response = await preview();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);

    expect(stripeSubscriptionCancellationSchema.strict().parse(body)).toStrictEqual({
      accountDeletion: { refund: { amount: 29.9, currency: "BRL" } },
      canResumeRenewal: false,
      cancellation: { endsAt: "2026-12-01T00:00:00.000Z", refund: null },
      extraordinary: { refund: { amount: 20.93, currency: "BRL" } },
      withdrawal: { refund: { amount: 29.9, currency: "BRL" }, until: "2026-11-14T00:00:00.000Z" },
    });
  });

  it("says there's nothing to cancel for a store subscription", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({ provider: "apple", status: "store" });
    const response = await preview();

    expect(response.status).toBe(404);
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

    const response = await cancel(cancelRequest({ choice: "withdrawal" }));
    const body: unknown = await response.json();

    expect(response.status).toBe(200);

    expect(cancelWebPlus).toHaveBeenCalledExactlyOnceWith({
      locale: "de",
      request: { choice: "withdrawal" },
    });

    expect(stripeSubscriptionCancellationReceiptSchema.strict().parse(body)).toStrictEqual({
      endsAt: "2026-11-03T10:00:00.000Z",
      receivedAt: "2026-11-03T10:00:00.000Z",
      refund: { amount: 1000, currency: "JPY" },
    });
  });

  it("refuses a choice that's no longer open", async () => {
    vi.mocked(cancelWebPlus).mockResolvedValue({ status: "unavailable" });

    const response = await cancel(cancelRequest({ choice: "withdrawal" }));

    expect(response.status).toBe(409);
  });

  it("refuses a request without the choice, or an extraordinary one without its reason", async () => {
    const responses = await Promise.all([
      cancel(cancelRequest({})),
      cancel(cancelRequest({ choice: "extraordinary" })),
      cancel(cancelRequest({ choice: "extraordinary", reason: "  " })),
    ]);

    expect(responses.map((response) => response.status)).toStrictEqual([400, 400, 400]);
    expect(cancelWebPlus).not.toHaveBeenCalled();
  });

  it("passes an extraordinary cancellation's reason on", async () => {
    vi.mocked(cancelWebPlus).mockResolvedValue({ status: "unavailable" });

    await cancel(cancelRequest({ choice: "extraordinary", reason: " I'm moving abroad " }));

    expect(cancelWebPlus).toHaveBeenCalledExactlyOnceWith({
      locale: "de",
      request: { choice: "extraordinary", reason: "I'm moving abroad" },
    });
  });
});

describe("DELETE /v1/me/subscriptions/stripe/cancellation", () => {
  it("keeps Plus, or says it can't once Plus ends sooner than its period", async () => {
    vi.mocked(keepWebPlus).mockResolvedValueOnce({ status: "kept" });
    vi.mocked(keepWebPlus).mockResolvedValueOnce({ status: "unavailable" });
    vi.mocked(keepWebPlus).mockResolvedValueOnce(null);

    const kept = await keep();
    const unavailable = await keep();
    const signedOut = await keep();

    expect([kept.status, unavailable.status, signedOut.status]).toStrictEqual([204, 409, 401]);
  });
});
