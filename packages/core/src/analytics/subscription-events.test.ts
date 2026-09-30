import { randomUUID } from "node:crypto";
import { reportSubscriptionChange } from "@zoonk/auth/subscription-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { trackServerEvent } from "./server";
import { registerSubscriptionAnalytics } from "./subscription-events";

// PostHog is an external service; the mock records what would leave the server.
vi.mock("./server", () => ({ trackServerEvent: vi.fn() }));

describe(registerSubscriptionAnalytics, () => {
  it('sends "Subscription Conversion" with the learner\'s mode when Stripe confirms a checkout', async () => {
    const user = await userFixture();
    await learningProfileFixture({ experienceMode: "fun", userId: user.id });
    registerSubscriptionAnalytics();

    await reportSubscriptionChange({ change: "started", plan: "plus", referenceId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Subscription Conversion",
        properties: { plan: "plus" },
        shared: expect.objectContaining({ mode: "fun" }),
      }),
    );
  });

  it('sends "Subscription Canceled" for the learner the Stripe webhook names', async () => {
    const user = await userFixture();
    registerSubscriptionAnalytics();

    await reportSubscriptionChange({ change: "canceled", plan: "plus", referenceId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Subscription Canceled",
        properties: { plan: "plus" },
      }),
    );
  });

  it("sends nothing for an organization's subscription", async () => {
    registerSubscriptionAnalytics();

    await reportSubscriptionChange({ change: "started", plan: "plus", referenceId: randomUUID() });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});
