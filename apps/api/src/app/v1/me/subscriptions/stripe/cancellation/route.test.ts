import {
  stripeSubscriptionCancellationReceiptSchema,
  stripeSubscriptionCancellationSchema,
} from "@/lib/openapi/schemas/subscriptions";
import { getWebPlusSubscription } from "@zoonk/core/subscriptions/get-web-plus-subscription";
import { cancelWebPlus, keepWebPlus } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { describe, expect, it, vi } from "vitest";
import { POST as cancel, DELETE as keep, GET as read } from "./route";

vi.mock("@zoonk/core/subscriptions/web-plus-cancellation", () => ({
  cancelWebPlus: vi.fn(),
  keepWebPlus: vi.fn(),
}));

vi.mock("@zoonk/core/subscriptions/get-web-plus-subscription", () => ({
  getWebPlusSubscription: vi.fn(),
}));

describe("GET /v1/me/subscriptions/stripe/cancellation", () => {
  it.each(["renewing", "ending", "unpaid"] as const)(
    "returns the saved %s website state",
    async (state) => {
      const periodEnd = state === "unpaid" ? null : new Date("2026-12-01T00:00:00Z");
      vi.mocked(getWebPlusSubscription).mockResolvedValue({ periodEnd, state, status: "ready" });
      const response = await read();
      expect(response.status).toBe(200);

      expect(
        stripeSubscriptionCancellationSchema.strict().parse(await response.json()),
      ).toStrictEqual({ periodEnd: periodEnd?.toISOString() ?? null, state });
    },
  );

  it("has no website state for a store-only subscriber", async () => {
    vi.mocked(getWebPlusSubscription).mockResolvedValue({ status: "none" });
    const response = await read();
    expect(response.status).toBe(404);
  });

  it("keeps a signed-in guest signed in while reporting no website subscription", async () => {
    vi.mocked(getWebPlusSubscription).mockResolvedValue({ status: "none" });
    vi.mocked(cancelWebPlus).mockResolvedValue({ status: "none" });
    vi.mocked(keepWebPlus).mockResolvedValue({ status: "none" });
    const readResponse = await read();
    const cancelResponse = await cancel();
    const keepResponse = await keep();

    expect([readResponse.status, cancelResponse.status, keepResponse.status]).toStrictEqual([
      404, 404, 404,
    ]);
  });

  it("requires a session", async () => {
    vi.mocked(getWebPlusSubscription).mockResolvedValue(null);
    const response = await read();
    expect(response.status).toBe(401);
  });
});

describe("POST /v1/me/subscriptions/stripe/cancellation", () => {
  it("cancels without a request body and returns the end date", async () => {
    vi.mocked(cancelWebPlus).mockResolvedValue({
      endsAt: new Date("2026-12-01T00:00:00Z"),
      status: "canceled",
    });

    const response = await cancel();
    expect(response.status).toBe(200);
    expect(cancelWebPlus).toHaveBeenCalledExactlyOnceWith();

    expect(
      stripeSubscriptionCancellationReceiptSchema.strict().parse(await response.json()),
    ).toStrictEqual({ endsAt: "2026-12-01T00:00:00.000Z" });
  });

  it("reports an unavailable subscription or a signed-out learner", async () => {
    vi.mocked(cancelWebPlus)
      .mockResolvedValueOnce({ status: "unavailable" })
      .mockResolvedValueOnce(null);

    const unavailable = await cancel();
    const signedOut = await cancel();

    expect([unavailable.status, signedOut.status]).toStrictEqual([409, 401]);
  });
});

describe("DELETE /v1/me/subscriptions/stripe/cancellation", () => {
  it("keeps Plus or reports an unavailable subscription or session", async () => {
    vi.mocked(keepWebPlus)
      .mockResolvedValueOnce({ status: "kept" })
      .mockResolvedValueOnce({ status: "unavailable" })
      .mockResolvedValueOnce(null);

    const kept = await keep();
    const unavailable = await keep();
    const signedOut = await keep();

    expect([kept.status, unavailable.status, signedOut.status]).toStrictEqual([204, 409, 401]);
  });
});
