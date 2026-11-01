import {
  stripeSubscriptionCancellationReceiptSchema,
  stripeSubscriptionCancellationSchema,
} from "@/lib/openapi/schemas/subscriptions";
import {
  cancelWebPlus,
  getWebPlusCancellation,
  keepWebPlus,
} from "@zoonk/core/subscriptions/web-plus-cancellation";
import { describe, expect, it, vi } from "vitest";
import { POST as cancel, DELETE as keep, GET as preview } from "./route";

vi.mock("@zoonk/core/subscriptions/web-plus-cancellation", () => ({
  cancelWebPlus: vi.fn(),
  getWebPlusCancellation: vi.fn(),
  keepWebPlus: vi.fn(),
}));

describe("GET /v1/me/subscriptions/stripe/cancellation", () => {
  it("answers the period end without cancellation choices or payment fields", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({
      canResumeRenewal: false,
      cancellation: { endsAt: new Date("2026-12-01T00:00:00Z") },
      status: "ready",
      unpaid: false,
    });

    const response = await preview();
    expect(response.status).toBe(200);

    expect(
      stripeSubscriptionCancellationSchema.strict().parse(await response.json()),
    ).toStrictEqual({
      canResumeRenewal: false,
      cancellation: { endsAt: "2026-12-01T00:00:00.000Z" },
      unpaid: false,
    });
  });

  it("reports a stopped renewal", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({
      canResumeRenewal: true,
      cancellation: null,
      status: "ready",
      unpaid: false,
    });

    const response = await preview();

    await expect(response.json()).resolves.toStrictEqual({
      canResumeRenewal: true,
      cancellation: null,
      unpaid: false,
    });
  });

  it("identifies an unpaid renewal so clients can explain immediate cancellation", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({
      canResumeRenewal: false,
      cancellation: { endsAt: new Date("2026-11-03T10:00:00Z") },
      status: "ready",
      unpaid: true,
    });

    const response = await preview();

    await expect(response.json()).resolves.toStrictEqual({
      canResumeRenewal: false,
      cancellation: { endsAt: "2026-11-03T10:00:00.000Z" },
      unpaid: true,
    });
  });

  it("has nothing to cancel for a store subscription", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue({ provider: "apple", status: "store" });
    const response = await preview();

    expect(response.status).toBe(404);
  });

  it("requires a session", async () => {
    vi.mocked(getWebPlusCancellation).mockResolvedValue(null);
    const response = await preview();

    expect(response.status).toBe(401);
  });
});

describe("POST /v1/me/subscriptions/stripe/cancellation", () => {
  it("cancels without a request body and returns the end and received dates", async () => {
    vi.mocked(cancelWebPlus).mockResolvedValue({
      endsAt: new Date("2026-12-01T00:00:00Z"),
      receivedAt: new Date("2026-11-03T10:00:00Z"),
      status: "canceled",
    });

    const response = await cancel();
    expect(response.status).toBe(200);
    expect(cancelWebPlus).toHaveBeenCalledExactlyOnceWith();

    expect(
      stripeSubscriptionCancellationReceiptSchema.strict().parse(await response.json()),
    ).toStrictEqual({ endsAt: "2026-12-01T00:00:00.000Z", receivedAt: "2026-11-03T10:00:00.000Z" });
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
