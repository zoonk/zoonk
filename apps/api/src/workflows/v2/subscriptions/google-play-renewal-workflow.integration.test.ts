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

const google = {
  acknowledged: true,
  acknowledgements: [] as string[],
  answer: "renewed" as "down" | "gone" | "renewed",
  reads: [] as string[],
  renewedUntil: new Date(0),
};

function getRenewedPurchase() {
  return {
    acknowledgementState: google.acknowledged
      ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
      : "ACKNOWLEDGEMENT_STATE_PENDING",
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
  };
}

/** Google's HTTP boundary; the workflow runtime's own requests go through. */
async function googleFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input);

  if (url.href === "https://oauth2.googleapis.com/token") {
    return Response.json({ access_token: "test-access-token", expires_in: 3600 });
  }

  if (url.hostname !== "androidpublisher.googleapis.com") {
    return realFetch(input, init);
  }

  if (url.pathname.endsWith(":acknowledge")) {
    google.acknowledged = true;
    google.acknowledgements.push(url.pathname);
    return new Response(null, { status: 200 });
  }

  google.reads.push(url.pathname);

  if (google.answer === "down") {
    return new Response(null, { status: 503 });
  }

  if (google.answer === "gone") {
    return new Response(null, { status: 410 });
  }

  return Response.json(getRenewedPurchase());
}

/** A Plus learner whose paid period ended a minute ago with no word from Google yet. */
async function lapsedRenewal({ acknowledged = true }: { acknowledged?: boolean } = {}) {
  const user = await userFixture();
  const lapsedAt = new Date(Date.now() - MINUTE_MS);

  return prisma.subscription.create({
    data: {
      billingInterval: "month",
      periodEnd: lapsedAt,
      periodStart: new Date(lapsedAt.getTime() - 30 * DAY_MS),
      plan: "plus",
      provider: "google",
      providerAcknowledged: acknowledged,
      providerSignedAt: lapsedAt,
      providerSubscriptionId: `purchase-token.${randomUUID()}`,
      referenceId: user.id,
      status: "active",
      userId: user.id,
    },
  });
}

/** Wakes a run at its checkpoint and returns the run it handed the subscription to. */
async function wakeUp(run: Run<string | null>) {
  await getRun(run.runId).wakeUp({ correlationIds: [await waitForSleep(run)] });
  const nextRunId = await run.returnValue;
  return nextRunId ? getRun<string | null>(nextRunId) : null;
}

function findSubscription(id: string) {
  return prisma.subscription.findUniqueOrThrow({ where: { id } });
}

describe(googlePlayRenewalWorkflow, () => {
  beforeEach(() => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    google.acknowledged = true;
    google.acknowledgements = [];
    google.answer = "renewed";
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

  it("keeps one live run per subscription, which saves what Google says at its checkpoint", async () => {
    const subscription = await lapsedRenewal();
    const run = await start(googlePlayRenewalWorkflow, [subscription.id]);
    await waitForSleep(run);

    const duplicate = await start(googlePlayRenewalWorkflow, [subscription.id]);
    await expect(duplicate.returnValue).resolves.toBeNull();
    expect(google.reads).toStrictEqual([]);

    await expect(wakeUp(run)).resolves.not.toBeNull();
    expect(google.reads).toHaveLength(1);

    await expect(findSubscription(subscription.id)).resolves.toMatchObject({
      endedAt: null,
      periodEnd: google.renewedUntil,
      status: "active",
    });
  });

  it("keeps one run through days without Google while saves start others, until Google answers", async () => {
    const subscription = await lapsedRenewal();
    google.answer = "down";

    const firstRun = await start(googlePlayRenewalWorkflow, [subscription.id]);
    const retry = await wakeUp(firstRun);
    const scheduledBySave = await start(googlePlayRenewalWorkflow, [subscription.id]);
    await expect(scheduledBySave.returnValue).resolves.toBeNull();

    const nextRetry = retry && (await wakeUp(retry));
    google.answer = "renewed";
    const afterRenewal = nextRetry && (await wakeUp(nextRetry));

    expect(afterRenewal).not.toBeNull();

    await expect(findSubscription(subscription.id)).resolves.toMatchObject({
      endedAt: null,
      periodEnd: google.renewedUntil,
    });
  });

  it("ends a subscription Google calls permanently invalid and stops checking it", async () => {
    const subscription = await lapsedRenewal();
    google.answer = "gone";

    const run = await start(googlePlayRenewalWorkflow, [subscription.id]);

    await expect(wakeUp(run)).resolves.toBeNull();
    await expect(findSubscription(subscription.id)).resolves.toMatchObject({ status: "canceled" });
  });

  it("acknowledges a purchase whose acknowledgement is still pending at its first checkpoint", async () => {
    const subscription = await lapsedRenewal({ acknowledged: false });
    google.acknowledged = false;

    const run = await start(googlePlayRenewalWorkflow, [subscription.id]);
    await wakeUp(run);

    expect(google.acknowledgements).toHaveLength(1);
  });
});
