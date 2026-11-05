import { randomUUID } from "node:crypto";
import { reportSubscriptionChange } from "@zoonk/auth/subscription-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { registerServerSinks } from "../server-sinks";
import { trackServerEvent } from "./server";
import { trackSubscriptionChange } from "./subscription-events";

describe(trackSubscriptionChange, () => {
  it('sends "Subscription Conversion" with the learner\'s shared properties when Stripe confirms a checkout', async () => {
    const user = await userFixture();
    registerServerSinks();

    await reportSubscriptionChange({ change: "started", plan: "plus", referenceId: user.id });

    expect(trackServerEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        distinctId: user.id,
        name: "Subscription Conversion",
        properties: { plan: "plus" },
        shared: expect.objectContaining({ is_guest: false }),
      }),
    );
  });

  it('sends "Subscription Canceled" for the learner the Stripe webhook names', async () => {
    const user = await userFixture();
    registerServerSinks();

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
    registerServerSinks();

    await reportSubscriptionChange({ change: "started", plan: "plus", referenceId: randomUUID() });

    expect(trackServerEvent).not.toHaveBeenCalled();
  });
});
