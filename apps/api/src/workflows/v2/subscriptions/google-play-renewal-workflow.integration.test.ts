import { generateKeyPairSync, randomUUID } from "node:crypto";
import { waitForSleep } from "@workflow/vitest";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRun, start } from "workflow/api";
import { googlePlayRenewalWorkflow } from "./google-play-renewal-workflow";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const realFetch = globalThis.fetch;

/** What Google was asked, and the period it reports the subscription renewed to. */
const google = { reads: [] as string[], renewedUntil: new Date(0) };

/** Google's HTTP boundary; the workflow runtime's own requests go through. */
async function googleFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input);

  if (url.href === "https://oauth2.googleapis.com/token") {
    return Response.json({ access_token: "test-access-token", expires_in: 3600 });
  }

  if (url.hostname !== "androidpublisher.googleapis.com") {
    return realFetch(input, init);
  }

  google.reads.push(url.pathname);

  return Response.json({
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    lineItems: [
      {
        autoRenewingPlan: { autoRenewEnabled: true },
        expiryTime: google.renewedUntil.toISOString(),
        offerDetails: { basePlanId: "monthly" },
        productId: "plus",
      },
    ],
    startTime: new Date(Date.now() - 30 * DAY_MS).toISOString(),
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  });
}

/** A Plus learner whose paid period ended a minute ago with no word from Google yet. */
async function lapsedRenewal() {
  const user = await userFixture();
  const purchaseToken = `purchase-token.${randomUUID()}`;
  const lapsedAt = new Date(Date.now() - MINUTE_MS);

  return prisma.subscription.create({
    data: {
      billingInterval: "month",
      periodEnd: lapsedAt,
      periodStart: new Date(lapsedAt.getTime() - 30 * DAY_MS),
      plan: "plus",
      provider: "google",
      providerSignedAt: lapsedAt,
      providerSubscriptionId: purchaseToken,
      referenceId: user.id,
      status: "active",
      userId: user.id,
    },
  });
}

describe(googlePlayRenewalWorkflow, () => {
  beforeEach(() => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    google.reads = [];
    google.renewedUntil = new Date(Date.now() + 30 * DAY_MS);

    vi.stubEnv(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY",
      JSON.stringify({
        client_email: "play-billing@zoonk-test.iam.gserviceaccount.com",
        private_key: privateKey.export({ format: "pem", type: "pkcs8" }),
      }),
    );

    vi.stubGlobal("fetch", vi.fn(googleFetch));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sleeps until the checkpoint, then saves what Google says, once per checkpoint", async () => {
    const subscription = await lapsedRenewal();
    const input = { checkAt: new Date(Date.now() + DAY_MS), subscriptionId: subscription.id };

    const run = await start(googlePlayRenewalWorkflow, [input]);
    const sleepId = await waitForSleep(run);
    const duplicate = await start(googlePlayRenewalWorkflow, [input]);
    await duplicate.returnValue;
    expect(google.reads).toStrictEqual([]);

    await getRun(run.runId).wakeUp({ correlationIds: [sleepId] });
    await run.returnValue;

    expect(google.reads).toHaveLength(1);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } }),
    ).resolves.toMatchObject({ endedAt: null, periodEnd: google.renewedUntil, status: "active" });
  });
});
