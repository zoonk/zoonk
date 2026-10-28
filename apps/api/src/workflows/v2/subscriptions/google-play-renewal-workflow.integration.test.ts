import { generateKeyPairSync, randomUUID } from "node:crypto";
import { waitForSleep } from "@workflow/vitest";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Run, getRun, start } from "workflow/api";
import { googlePlayRenewalWorkflow } from "./google-play-renewal-workflow";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const realFetch = globalThis.fetch;

const google = { isDown: false, reads: [] as string[], renewedUntil: new Date(0) };

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

  if (google.isDown) {
    return new Response(null, { status: 503 });
  }

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

/** Wakes a run at its checkpoint and returns the run it handed off to. */
async function wakeUp(run: Run<string | null>) {
  await getRun(run.runId).wakeUp({ correlationIds: [await waitForSleep(run)] });
  const nextRunId = await run.returnValue;

  if (!nextRunId) {
    throw new Error("The renewal check ended its chain");
  }

  return getRun<string | null>(nextRunId);
}

describe(googlePlayRenewalWorkflow, () => {
  beforeEach(() => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    google.isDown = false;
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

  it("keeps checking a day apart while Google can't be reached, until it answers", async () => {
    const subscription = await lapsedRenewal();
    google.isDown = true;

    const firstRun = await start(googlePlayRenewalWorkflow, [
      { checkAt: new Date(Date.now() + DAY_MS), subscriptionId: subscription.id },
    ]);

    const secondRun = await wakeUp(firstRun);
    const thirdRun = await wakeUp(secondRun);
    google.isDown = false;
    await wakeUp(thirdRun);

    await expect(
      prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } }),
    ).resolves.toMatchObject({ endedAt: null, periodEnd: google.renewedUntil, status: "active" });
  });
});
