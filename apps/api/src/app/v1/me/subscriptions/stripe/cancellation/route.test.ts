import { stripeSubscriptionCancellationSchema } from "@/lib/openapi/schemas/subscriptions";
import { createWebPlusCancellation } from "@zoonk/core/subscriptions/web-plus-cancellation";
import { describe, expect, it, vi } from "vitest";
import { POST as cancel } from "./route";

vi.mock("@zoonk/core/subscriptions/web-plus-cancellation", () => ({
  createWebPlusCancellation: vi.fn(),
}));

describe("POST /v1/me/subscriptions/stripe/cancellation", () => {
  it("answers Stripe's cancellation page in the documented shape", async () => {
    vi.mocked(createWebPlusCancellation).mockResolvedValue({
      status: "ready",
      url: "https://billing.stripe.com/p/session/cancel",
    });

    const response = await cancel();

    const body: unknown = await response.json();

    expect(response.status).toBe(200);

    expect(stripeSubscriptionCancellationSchema.strict().parse(body)).toStrictEqual({
      url: "https://billing.stripe.com/p/session/cancel",
    });
  });

  it("says there's nothing to cancel without an active web subscription", async () => {
    vi.mocked(createWebPlusCancellation).mockResolvedValue({ status: "none" });

    const response = await cancel();

    expect(response.status).toBe(404);
  });

  it("asks for a session", async () => {
    vi.mocked(createWebPlusCancellation).mockResolvedValue(null);

    const response = await cancel();

    expect(response.status).toBe(401);
  });
});
