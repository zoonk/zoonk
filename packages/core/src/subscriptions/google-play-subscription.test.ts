import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { SignJWT, exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { hasActiveSubscription } from "../auth/subscription";
import { checkGooglePlayRenewal } from "./check-google-play-renewal";
import { processGooglePlayNotification } from "./process-google-play-notification";
import { syncCurrentUserGooglePlaySubscription } from "./sync-google-play-subscription";

const PACKAGE_NAME = "com.zoonk";
const AUDIENCE = "https://api.zoonk.test/v1/subscriptions/google/notifications";
const SERVICE_ACCOUNT_EMAIL = "play-billing@zoonk-test.iam.gserviceaccount.com";
const PUSH_KEY_ID = "test-push-key";
const ORDER_ID = "GPA.3300-0000-0000-00000";

const START_TIME = new Date("2026-10-01T12:00:00.000Z");
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const NOTIFICATION = {
  canceled: 3,
  expired: 13,
  inGracePeriod: 6,
  onHold: 5,
  purchased: 4,
  recovered: 1,
  renewed: 2,
} as const;

// Pub/Sub signs pushes with Google's keys; these stand in for them and for the service account's.
const pushKeys = await generateKeyPair("RS256");
const serviceAccountKeys = await generateKeyPair("RS256", { extractable: true });
const pushPublicKey = { ...(await exportJWK(pushKeys.publicKey)), alg: "RS256", kid: PUSH_KEY_ID };

const SERVICE_ACCOUNT_KEY = JSON.stringify({
  client_email: SERVICE_ACCOUNT_EMAIL,
  private_key: await exportPKCS8(serviceAccountKeys.privateKey),
  type: "service_account",
});

type PurchaseOptions = {
  accountId?: string;
  acknowledged?: boolean;
  autoRenewEnabled?: boolean;
  basePlanId?: string;
  expiryTime?: Date;
  extra?: Record<string, unknown>;
  productId?: string;
  state?: string;
};

function makePurchase({
  accountId,
  acknowledged = false,
  autoRenewEnabled = true,
  basePlanId = "monthly",
  expiryTime = new Date(Date.now() + 30 * DAY_MS),
  extra = {},
  productId = "plus",
  state = "SUBSCRIPTION_STATE_ACTIVE",
}: PurchaseOptions) {
  return {
    acknowledgementState: acknowledged
      ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
      : "ACKNOWLEDGEMENT_STATE_PENDING",
    ...(accountId && { externalAccountIdentifiers: { obfuscatedExternalAccountId: accountId } }),
    kind: "androidpublisher#subscriptionPurchaseV2",
    lineItems: [
      {
        autoRenewingPlan: { autoRenewEnabled },
        expiryTime: expiryTime.toISOString(),
        latestSuccessfulOrderId: ORDER_ID,
        offerDetails: { basePlanId },
        productId,
      },
    ],
    regionCode: "BR",
    startTime: START_TIME.toISOString(),
    subscriptionState: state,
    ...extra,
  };
}

const google = {
  /** Another request acknowledged the purchase a moment earlier, so Google refuses this one. */
  acknowledgedConcurrently: false,
  acknowledgements: [] as { body: unknown; productId: string; purchaseToken: string }[],
  /**
   * Reads of a token Google answers late: with the state as it was when the read started
   * (`readFirst`), or as it is when the answer finally goes out.
   */
  holds: new Map<string, { readFirst: boolean; until: Promise<unknown> }>(),
  purchases: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
};

function setPurchase(purchaseToken: string, options: PurchaseOptions) {
  google.purchases.set(purchaseToken, makePurchase(options));
}

function getRequestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) {
    return new URL(input.url);
  }

  return new URL(input);
}

/** Google's HTTP boundary: OAuth tokens, its signing keys and the Developer API. */
async function googleFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = getRequestUrl(input);

  if (url.href === "https://oauth2.googleapis.com/token") {
    return Response.json({ access_token: "test-access-token", expires_in: 3600 });
  }

  if (url.href === "https://www.googleapis.com/oauth2/v3/certs") {
    return Response.json({ keys: [pushPublicKey] });
  }

  const path = url.pathname.replace(`/androidpublisher/v3/applications/${PACKAGE_NAME}/`, "");
  const read = /^purchases\/subscriptionsv2\/tokens\/(?<token>[^/]+)$/u.exec(path)?.groups;

  if (read?.token) {
    const purchaseToken = decodeURIComponent(read.token);
    google.reads.push(purchaseToken);
    const hold = google.holds.get(purchaseToken);
    google.holds.delete(purchaseToken);
    const readAtStart = google.purchases.get(purchaseToken);
    await hold?.until;
    const purchase = hold?.readFirst ? readAtStart : google.purchases.get(purchaseToken);
    return purchase ? Response.json(purchase) : new Response(null, { status: 404 });
  }

  const acknowledgement =
    /^purchases\/subscriptions\/(?<product>[^/]+)\/tokens\/(?<token>[^/]+):acknowledge$/u.exec(
      path,
    )?.groups;

  if (acknowledgement?.product && acknowledgement.token && typeof init?.body === "string") {
    const purchaseToken = decodeURIComponent(acknowledgement.token);
    const productId = decodeURIComponent(acknowledgement.product);
    google.acknowledgements.push({ body: JSON.parse(init.body), productId, purchaseToken });

    google.purchases.set(purchaseToken, {
      ...google.purchases.get(purchaseToken),
      acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    });

    return new Response(null, { status: google.acknowledgedConcurrently ? 409 : 200 });
  }

  throw new Error(`Unexpected request to ${url.href}`);
}

function makePushToken({
  audience = AUDIENCE,
  email = SERVICE_ACCOUNT_EMAIL,
}: { audience?: string; email?: string } = {}) {
  return new SignJWT({ email, email_verified: true })
    .setProtectedHeader({ alg: "RS256", kid: PUSH_KEY_ID })
    .setIssuer("https://accounts.google.com")
    .setAudience(audience)
    .setSubject("112233445566778899")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pushKeys.privateKey);
}

async function push(
  notification: Record<string, unknown>,
  {
    authorization,
    messageId = randomUUID(),
  }: { authorization?: string | null; messageId?: string } = {},
) {
  const developerNotification = {
    eventTimeMillis: String(Date.now()),
    packageName: PACKAGE_NAME,
    version: "1.0",
    ...notification,
  };

  return processGooglePlayNotification({
    audience: AUDIENCE,
    authorization: authorization === undefined ? `Bearer ${await makePushToken()}` : authorization,
    message: {
      data: Buffer.from(JSON.stringify(developerNotification)).toString("base64"),
      messageId,
    },
  });
}

function pushSubscriptionChange(purchaseToken: string, notificationType: number) {
  return push({ subscriptionNotification: { notificationType, purchaseToken, version: "1.0" } });
}

function findGoogleSubscription(purchaseToken: string) {
  return prisma.subscription.findUnique({
    where: {
      provider_providerSubscriptionId: {
        provider: "google",
        providerSubscriptionId: purchaseToken,
      },
    },
  });
}

/** Holds Google's answer to the next read of a token until the returned function is called. */
function holdRead(purchaseToken: string, { readFirst }: { readFirst: boolean }) {
  const { promise, resolve } = Promise.withResolvers();
  google.holds.set(purchaseToken, { readFirst, until: promise });
  return () => resolve(null);
}

async function waitForReads(purchaseToken: string, count: number) {
  await vi.waitFor(() => {
    expect(google.reads.filter((token) => token === purchaseToken)).toHaveLength(count);
  });
}

function sync(purchaseToken: string) {
  return syncCurrentUserGooglePlaySubscription({ purchaseToken });
}

async function findSubscriptionId(purchaseToken: string) {
  const subscription = await findGoogleSubscription(purchaseToken);

  if (!subscription) {
    throw new Error(`No subscription saved for ${purchaseToken}`);
  }

  return subscription.id;
}

async function checkRenewal(purchaseToken: string) {
  return checkGooglePlayRenewal(await findSubscriptionId(purchaseToken));
}

function makePurchaseToken() {
  return `purchase-token.${randomUUID()}`;
}

async function hasPlus(userId: string) {
  mockSession(userId);
  return hasActiveSubscription();
}

describe("Google Play subscriptions", () => {
  beforeEach(() => {
    google.acknowledgements = [];
    google.acknowledgedConcurrently = false;
    google.holds.clear();
    google.purchases.clear();
    google.reads = [];
    vi.stubEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_KEY", SERVICE_ACCOUNT_KEY);
    vi.stubGlobal("fetch", vi.fn(googleFetch));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe(syncCurrentUserGooglePlaySubscription, () => {
    it("requires a signed-in account before asking Google", async () => {
      mockSession(null);

      await expect(
        syncCurrentUserGooglePlaySubscription({ purchaseToken: makePurchaseToken() }),
      ).rejects.toMatchObject({ reason: "unauthorized" });

      expect(fetch).not.toHaveBeenCalled();
    });

    it("links and acknowledges a purchase made for the signed-in account", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      const expiryTime = new Date(Date.now() + 30 * DAY_MS);
      setPurchase(purchaseToken, { accountId: user.id, expiryTime });
      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).resolves.toStrictEqual(
        {
          isActive: true,
          renewalCheck: { checkAt: expiryTime, subscriptionId: expect.any(String) },
        },
      );

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        billingInterval: "month",
        cancelAtPeriodEnd: false,
        endedAt: null,
        periodEnd: expiryTime,
        periodStart: START_TIME,
        plan: "plus",
        providerEnvironment: "production",
        providerEventId: null,
        providerProductId: "plus:monthly",
        providerTransactionId: ORDER_ID,
        referenceId: user.id,
        status: "active",
        userId: user.id,
      });

      expect(google.acknowledgements).toStrictEqual([
        { body: {}, productId: "plus", purchaseToken },
      ]);

      await expect(hasPlus(user.id)).resolves.toBe(true);
    });

    it("doesn't acknowledge a purchase Google already has acknowledged", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id, acknowledged: true, basePlanId: "yearly" });
      mockSession(user.id);

      await syncCurrentUserGooglePlaySubscription({ purchaseToken });

      expect(google.acknowledgements).toStrictEqual([]);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        billingInterval: "year",
        providerProductId: "plus:yearly",
      });
    });

    it("refuses a purchase made for another account", async () => {
      const [user, otherUser] = await Promise.all([userFixture(), userFixture()]);
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: otherUser.id });
      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).rejects.toMatchObject({
        reason: "accountMismatch",
      });

      await expect(findGoogleSubscription(purchaseToken)).resolves.toBeNull();
      expect(google.acknowledgements).toStrictEqual([]);
    });

    it("links a purchase made in the Play Store, which names no account, to the signed-in learner", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, {});
      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).resolves.toMatchObject(
        { isActive: true },
      );

      expect(google.acknowledgements).toStrictEqual([
        { body: {}, productId: "plus", purchaseToken },
      ]);

      await expect(hasPlus(user.id)).resolves.toBe(true);
    });

    it("keeps a purchase token with the account that claimed it first", async () => {
      const [firstUser, secondUser] = await Promise.all([userFixture(), userFixture()]);
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, {});
      mockSession(firstUser.id);
      await syncCurrentUserGooglePlaySubscription({ purchaseToken });
      mockSession(secondUser.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).rejects.toMatchObject({
        reason: "conflict",
      });

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        referenceId: firstUser.id,
      });

      await expect(hasPlus(secondUser.id)).resolves.toBe(false);
    });

    it("links a purchase the notification acknowledged a moment earlier", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      google.acknowledgedConcurrently = true;
      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).resolves.toMatchObject(
        { isActive: true },
      );

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        referenceId: user.id,
        status: "active",
      });
    });

    it.each([
      { basePlanId: "weekly", productId: "plus" },
      { basePlanId: "monthly", productId: "pro" },
    ])("refuses $productId:$basePlanId, which Zoonk doesn't sell", async (product) => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id, ...product });
      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).rejects.toMatchObject({
        reason: "invalidProduct",
      });

      expect(google.acknowledgements).toStrictEqual([]);
    });

    it("grants nothing while a purchase waits for payment", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();

      google.purchases.set(purchaseToken, {
        acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
        externalAccountIdentifiers: { obfuscatedExternalAccountId: user.id },
        lineItems: [{ offerDetails: { basePlanId: "monthly" }, productId: "plus" }],
        subscriptionState: "SUBSCRIPTION_STATE_PENDING",
      });

      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).resolves.toStrictEqual(
        { isActive: false, renewalCheck: null },
      );

      await expect(findGoogleSubscription(purchaseToken)).resolves.toBeNull();
      expect(google.acknowledgements).toStrictEqual([]);
    });

    it("refuses a purchase token Google doesn't know", async () => {
      const user = await userFixture();
      mockSession(user.id);

      await expect(
        syncCurrentUserGooglePlaySubscription({ purchaseToken: makePurchaseToken() }),
      ).rejects.toMatchObject({ reason: "invalidPurchase" });
    });

    it("links a resubscription from the Play Store through the expired purchase's account", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();

      setPurchase(purchaseToken, {
        extra: {
          outOfAppPurchaseContext: {
            expiredExternalAccountIdentifiers: { obfuscatedExternalAccountId: user.id },
            expiredPurchaseToken: makePurchaseToken(),
          },
        },
      });

      mockSession(user.id);

      await expect(syncCurrentUserGooglePlaySubscription({ purchaseToken })).resolves.toMatchObject(
        { isActive: true },
      );

      expect(google.acknowledgements).toStrictEqual([
        {
          body: { externalAccountIds: { obfuscatedAccountId: user.id } },
          productId: "plus",
          purchaseToken,
        },
      ]);
    });

    it("ends the subscription an upgrade replaced", async () => {
      const user = await userFixture();
      const [monthlyToken, yearlyToken] = [makePurchaseToken(), makePurchaseToken()];
      setPurchase(monthlyToken, { accountId: user.id });
      mockSession(user.id);
      await syncCurrentUserGooglePlaySubscription({ purchaseToken: monthlyToken });

      setPurchase(yearlyToken, {
        accountId: user.id,
        basePlanId: "yearly",
        expiryTime: new Date(Date.now() + 365 * DAY_MS),
        extra: { linkedPurchaseToken: monthlyToken },
      });

      await syncCurrentUserGooglePlaySubscription({ purchaseToken: yearlyToken });

      await expect(findGoogleSubscription(monthlyToken)).resolves.toMatchObject({
        endedAt: START_TIME,
        status: "canceled",
      });

      await expect(findGoogleSubscription(yearlyToken)).resolves.toMatchObject({
        billingInterval: "year",
        status: "active",
      });

      await expect(hasPlus(user.id)).resolves.toBe(true);
    });
  });

  describe(processGooglePlayNotification, () => {
    it("refuses a push that isn't Google's for Zoonk's service account and audience", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      const notification = { subscriptionNotification: { notificationType: 4, purchaseToken } };

      const authorizations = [
        null,
        "Bearer not-a-token",
        `Bearer ${await makePushToken({ email: "someone@example.iam.gserviceaccount.com" })}`,
        `Bearer ${await makePushToken({ audience: "https://example.com/push" })}`,
      ];

      for (const authorization of authorizations) {
        // oxlint-disable-next-line no-await-in-loop -- Each forged push is refused on its own.
        await expect(push(notification, { authorization })).rejects.toMatchObject({
          reason: "unauthorized",
        });
      }

      expect(google.reads).toStrictEqual([]);
      await expect(findGoogleSubscription(purchaseToken)).resolves.toBeNull();
    });

    it("creates and acknowledges an entitlement when the purchase arrives before the app", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      const messageId = randomUUID();

      await push(
        { subscriptionNotification: { notificationType: NOTIFICATION.purchased, purchaseToken } },
        { messageId },
      );

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        providerEventId: messageId,
        referenceId: user.id,
        status: "active",
      });

      expect(google.acknowledgements).toHaveLength(1);
      await expect(hasPlus(user.id)).resolves.toBe(true);
    });

    it("moves the period forward on a renewal", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      await pushSubscriptionChange(purchaseToken, NOTIFICATION.purchased);

      const renewedUntil = new Date(Date.now() + 60 * DAY_MS);

      setPurchase(purchaseToken, {
        accountId: user.id,
        acknowledged: true,
        expiryTime: renewedUntil,
      });

      await pushSubscriptionChange(purchaseToken, NOTIFICATION.renewed);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        periodEnd: renewedUntil,
        status: "active",
      });

      expect(google.acknowledgements).toHaveLength(1);
    });

    it("keeps access until the period ends after the learner cancels", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      const expiryTime = new Date(Date.now() + 10 * DAY_MS);
      const cancelTime = new Date(Date.now() - DAY_MS);

      setPurchase(purchaseToken, {
        accountId: user.id,
        acknowledged: true,
        autoRenewEnabled: false,
        expiryTime,
        extra: {
          canceledStateContext: {
            userInitiatedCancellation: { cancelTime: cancelTime.toISOString() },
          },
        },
        state: "SUBSCRIPTION_STATE_CANCELED",
      });

      await pushSubscriptionChange(purchaseToken, NOTIFICATION.canceled);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        cancelAt: expiryTime,
        cancelAtPeriodEnd: true,
        canceledAt: cancelTime,
        endedAt: null,
        status: "active",
      });

      await expect(hasPlus(user.id)).resolves.toBe(true);
    });

    it("ends access when the subscription expires", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      await pushSubscriptionChange(purchaseToken, NOTIFICATION.purchased);

      const expiredAt = new Date(Date.now() - DAY_MS);

      setPurchase(purchaseToken, {
        accountId: user.id,
        acknowledged: true,
        autoRenewEnabled: false,
        expiryTime: expiredAt,
        state: "SUBSCRIPTION_STATE_EXPIRED",
      });

      await pushSubscriptionChange(purchaseToken, NOTIFICATION.expired);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        cancelAtPeriodEnd: false,
        endedAt: expiredAt,
        status: "canceled",
      });

      await expect(hasPlus(user.id)).resolves.toBe(false);
    });

    it("keeps access through a grace period, blocks it on hold and restores it on recovery", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      const retrying = { accountId: user.id, acknowledged: true };

      setPurchase(purchaseToken, {
        ...retrying,
        expiryTime: new Date(Date.now() + 3 * DAY_MS),
        state: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
      });

      await pushSubscriptionChange(purchaseToken, NOTIFICATION.inGracePeriod);
      await expect(hasPlus(user.id)).resolves.toBe(true);

      const heldSince = new Date(Date.now() - DAY_MS);

      setPurchase(purchaseToken, {
        ...retrying,
        expiryTime: heldSince,
        state: "SUBSCRIPTION_STATE_ON_HOLD",
      });

      await pushSubscriptionChange(purchaseToken, NOTIFICATION.onHold);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        endedAt: heldSince,
        status: "canceled",
      });

      await expect(hasPlus(user.id)).resolves.toBe(false);

      setPurchase(purchaseToken, { ...retrying, expiryTime: new Date(Date.now() + 30 * DAY_MS) });
      await pushSubscriptionChange(purchaseToken, NOTIFICATION.recovered);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        endedAt: null,
        status: "active",
      });

      await expect(hasPlus(user.id)).resolves.toBe(true);
    });

    it("ends access at once when the purchase is refunded", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      const paidUntil = new Date(Date.now() + 20 * DAY_MS);
      setPurchase(purchaseToken, { accountId: user.id, expiryTime: paidUntil });
      await pushSubscriptionChange(purchaseToken, NOTIFICATION.purchased);

      setPurchase(purchaseToken, {
        accountId: user.id,
        acknowledged: true,
        autoRenewEnabled: false,
        expiryTime: paidUntil,
        state: "SUBSCRIPTION_STATE_EXPIRED",
      });

      await push({
        voidedPurchaseNotification: {
          orderId: ORDER_ID,
          productType: 1,
          purchaseToken,
          refundType: 1,
        },
      });

      const subscription = await findGoogleSubscription(purchaseToken);

      expect(subscription).toMatchObject({ status: "canceled" });
      expect(subscription?.endedAt?.getTime()).toBeLessThanOrEqual(Date.now());
      await expect(hasPlus(user.id)).resolves.toBe(false);
    });

    it("reads Google once per message however often Pub/Sub delivers it", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      const messageId = randomUUID();

      const notification = {
        subscriptionNotification: { notificationType: NOTIFICATION.purchased, purchaseToken },
      };

      const first = await push(notification, { messageId });
      const again = await push(notification, { messageId });

      expect(again).toStrictEqual(first);
      expect(google.reads).toStrictEqual([purchaseToken]);
      expect(google.acknowledgements).toHaveLength(1);
    });

    it("saves nothing for a purchase whose account doesn't exist", async () => {
      const user = await userFixture();
      await prisma.user.delete({ where: { id: user.id } });
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });

      await expect(
        pushSubscriptionChange(purchaseToken, NOTIFICATION.purchased),
      ).resolves.toBeNull();

      await expect(findGoogleSubscription(purchaseToken)).resolves.toBeNull();
      expect(google.acknowledgements).toStrictEqual([]);
    });

    it("asks Google nothing for test, one-time product and other apps' notifications", async () => {
      const purchaseToken = makePurchaseToken();

      await expect(push({ testNotification: { version: "1.0" } })).resolves.toBeNull();

      await expect(
        push({ oneTimeProductNotification: { notificationType: 1, purchaseToken, sku: "coins" } }),
      ).resolves.toBeNull();

      await expect(
        push({ voidedPurchaseNotification: { orderId: ORDER_ID, productType: 2, purchaseToken } }),
      ).resolves.toBeNull();

      await expect(
        push({
          packageName: "com.example.other",
          subscriptionNotification: { notificationType: NOTIFICATION.renewed, purchaseToken },
        }),
      ).resolves.toBeNull();

      expect(google.reads).toStrictEqual([]);
    });
  });

  describe("purchase lines", () => {
    it("recovers a Play Store resubscription's owner from the purchase that expired before it", async () => {
      const [owner, other] = await Promise.all([userFixture(), userFixture()]);

      const [expiredToken, resubscribedToken, laterToken] = [
        makePurchaseToken(),
        makePurchaseToken(),
        makePurchaseToken(),
      ];

      setPurchase(expiredToken, {});
      mockSession(owner.id);
      await sync(expiredToken);

      const resubscription = {
        extra: { outOfAppPurchaseContext: { expiredPurchaseToken: expiredToken } },
      };

      setPurchase(resubscribedToken, resubscription);
      await pushSubscriptionChange(resubscribedToken, NOTIFICATION.purchased);

      await expect(findGoogleSubscription(resubscribedToken)).resolves.toMatchObject({
        referenceId: owner.id,
        status: "active",
      });

      expect(google.acknowledgements.at(-1)).toStrictEqual({
        body: { externalAccountIds: { obfuscatedAccountId: owner.id } },
        productId: "plus",
        purchaseToken: resubscribedToken,
      });

      setPurchase(laterToken, resubscription);
      mockSession(other.id);

      await expect(sync(laterToken)).rejects.toMatchObject({ reason: "accountMismatch" });
      await expect(hasPlus(other.id)).resolves.toBe(false);
    });

    it("refuses a replacement bought under another account, so one line never gives two learners Plus", async () => {
      const [owner, other] = await Promise.all([userFixture(), userFixture()]);
      const [oldToken, newToken] = [makePurchaseToken(), makePurchaseToken()];
      setPurchase(oldToken, {});
      mockSession(owner.id);
      await sync(oldToken);

      setPurchase(newToken, { accountId: other.id, extra: { linkedPurchaseToken: oldToken } });
      mockSession(other.id);

      await expect(sync(newToken)).rejects.toMatchObject({ reason: "accountMismatch" });

      await expect(pushSubscriptionChange(newToken, NOTIFICATION.purchased)).rejects.toMatchObject({
        reason: "accountMismatch",
      });

      await expect(findGoogleSubscription(newToken)).resolves.toBeNull();
      await expect(hasPlus(other.id)).resolves.toBe(false);

      await expect(findGoogleSubscription(oldToken)).resolves.toMatchObject({
        referenceId: owner.id,
        status: "active",
      });

      expect(google.acknowledgements.map(({ purchaseToken }) => purchaseToken)).toStrictEqual([
        oldToken,
      ]);
    });

    it("keeps a replaced purchase ended when a read of it from before the replacement saves late", async () => {
      const user = await userFixture();
      const [oldToken, newToken] = [makePurchaseToken(), makePurchaseToken()];
      setPurchase(oldToken, { accountId: user.id });
      mockSession(user.id);
      await sync(oldToken);

      const release = holdRead(oldToken, { readFirst: true });
      const lateSave = sync(oldToken);
      await waitForReads(oldToken, 2);

      setPurchase(oldToken, {
        accountId: user.id,
        acknowledged: true,
        autoRenewEnabled: false,
        expiryTime: new Date(Date.now() - MINUTE_MS),
        state: "SUBSCRIPTION_STATE_EXPIRED",
      });

      const replacement = {
        accountId: user.id,
        basePlanId: "yearly",
        expiryTime: new Date(Date.now() + 365 * DAY_MS),
        extra: { linkedPurchaseToken: oldToken },
      };

      setPurchase(newToken, replacement);
      await pushSubscriptionChange(newToken, NOTIFICATION.purchased);
      release();
      await lateSave;

      await expect(findGoogleSubscription(oldToken)).resolves.toMatchObject({ status: "canceled" });

      setPurchase(newToken, {
        ...replacement,
        acknowledged: true,
        autoRenewEnabled: false,
        state: "SUBSCRIPTION_STATE_EXPIRED",
      });

      await push({
        voidedPurchaseNotification: { orderId: ORDER_ID, productType: 1, purchaseToken: newToken },
      });

      await expect(hasPlus(user.id)).resolves.toBe(false);
    });

    it("ends a replaced purchase on the replacement's next save when the old one was first saved late", async () => {
      const user = await userFixture();
      const [oldToken, newToken] = [makePurchaseToken(), makePurchaseToken()];
      setPurchase(oldToken, { accountId: user.id });
      mockSession(user.id);

      const release = holdRead(oldToken, { readFirst: true });
      const lateSave = sync(oldToken);
      await waitForReads(oldToken, 1);

      const replacement = {
        accountId: user.id,
        basePlanId: "yearly",
        expiryTime: new Date(Date.now() + 365 * DAY_MS),
        extra: { linkedPurchaseToken: oldToken },
      };

      setPurchase(newToken, replacement);
      await pushSubscriptionChange(newToken, NOTIFICATION.purchased);
      release();
      await lateSave;

      setPurchase(newToken, { ...replacement, acknowledged: true });
      await pushSubscriptionChange(newToken, NOTIFICATION.renewed);

      await expect(findGoogleSubscription(oldToken)).resolves.toMatchObject({ status: "canceled" });
    });

    it("reads Google again when another save lands between its read and its own save", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      setPurchase(purchaseToken, { accountId: user.id });
      mockSession(user.id);
      await sync(purchaseToken);

      const release = holdRead(purchaseToken, { readFirst: false });
      const slowSave = pushSubscriptionChange(purchaseToken, NOTIFICATION.renewed);
      await waitForReads(purchaseToken, 2);
      await sync(purchaseToken);

      setPurchase(purchaseToken, {
        accountId: user.id,
        acknowledged: true,
        autoRenewEnabled: false,
        expiryTime: new Date(Date.now() - MINUTE_MS),
        state: "SUBSCRIPTION_STATE_EXPIRED",
      });

      release();
      await slowSave;

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        status: "canceled",
      });

      await expect(hasPlus(user.id)).resolves.toBe(false);
      expect(google.reads.filter((token) => token === purchaseToken)).toHaveLength(4);
    });
  });

  describe(checkGooglePlayRenewal, () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("keeps Plus past a paid period nobody notified about while Google retries the payment", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      const paidUntil = new Date(Date.now() + DAY_MS);
      setPurchase(purchaseToken, { accountId: user.id, expiryTime: paidUntil });
      mockSession(user.id);
      await sync(purchaseToken);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(paidUntil.getTime() + MINUTE_MS);
      await expect(hasPlus(user.id)).resolves.toBe(true);

      await expect(checkRenewal(purchaseToken)).resolves.toStrictEqual(
        new Date(paidUntil.getTime() + DAY_MS),
      );

      await expect(hasPlus(user.id)).resolves.toBe(true);

      const renewedUntil = new Date(paidUntil.getTime() + 30 * DAY_MS);

      setPurchase(purchaseToken, {
        accountId: user.id,
        acknowledged: true,
        expiryTime: renewedUntil,
      });

      vi.setSystemTime(paidUntil.getTime() + DAY_MS + MINUTE_MS);
      await expect(checkRenewal(purchaseToken)).resolves.toStrictEqual(renewedUntil);

      await expect(findGoogleSubscription(purchaseToken)).resolves.toMatchObject({
        endedAt: null,
        periodEnd: renewedUntil,
      });
    });

    it("follows a grace period Google extends after the first read, then ends access on hold", async () => {
      const user = await userFixture();
      const purchaseToken = makePurchaseToken();
      const graceUntil = new Date(Date.now() + DAY_MS);
      const extendedUntil = new Date(Date.now() + 3 * DAY_MS);

      const inGrace = {
        accountId: user.id,
        acknowledged: true,
        state: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
      };

      setPurchase(purchaseToken, { ...inGrace, expiryTime: graceUntil });
      mockSession(user.id);
      await sync(purchaseToken);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(graceUntil.getTime() + MINUTE_MS);
      setPurchase(purchaseToken, { ...inGrace, expiryTime: extendedUntil });

      await expect(checkRenewal(purchaseToken)).resolves.toStrictEqual(extendedUntil);
      await expect(hasPlus(user.id)).resolves.toBe(true);

      vi.setSystemTime(extendedUntil.getTime() + MINUTE_MS);

      setPurchase(purchaseToken, {
        ...inGrace,
        expiryTime: extendedUntil,
        state: "SUBSCRIPTION_STATE_ON_HOLD",
      });

      await expect(checkRenewal(purchaseToken)).resolves.toBeNull();
      await expect(hasPlus(user.id)).resolves.toBe(false);
    });

    it("asks Google nothing before the checkpoint or once Google has ended the purchase", async () => {
      const user = await userFixture();
      const [renewedToken, endedToken] = [makePurchaseToken(), makePurchaseToken()];
      const renewedUntil = new Date(Date.now() + 30 * DAY_MS);
      setPurchase(renewedToken, { accountId: user.id, expiryTime: renewedUntil });

      setPurchase(endedToken, {
        accountId: user.id,
        expiryTime: new Date(Date.now() - MINUTE_MS),
        state: "SUBSCRIPTION_STATE_EXPIRED",
      });

      mockSession(user.id);
      await Promise.all([sync(renewedToken), sync(endedToken)]);
      google.reads = [];

      await expect(checkRenewal(renewedToken)).resolves.toStrictEqual(renewedUntil);
      await expect(checkRenewal(endedToken)).resolves.toBeNull();
      expect(google.reads).toStrictEqual([]);
    });
  });

  describe("Google Play entitlement", () => {
    it("keeps a renewing purchase past its period until Google says otherwise, not a canceled one", async () => {
      const [renewing, canceled] = await Promise.all([userFixture(), userFixture()]);

      await prisma.subscription.createMany({
        data: [renewing, canceled].map((user) => ({
          cancelAtPeriodEnd: user === canceled,
          periodEnd: new Date(Date.now() - MINUTE_MS),
          plan: "plus",
          provider: "google" as const,
          providerSubscriptionId: makePurchaseToken(),
          referenceId: user.id,
          status: "active",
          userId: user.id,
        })),
      });

      await expect(hasPlus(renewing.id)).resolves.toBe(true);
      await expect(hasPlus(canceled.id)).resolves.toBe(false);
    });

    it("can't exist without an owner and a purchase token", async () => {
      const user = await userFixture();

      const row = {
        plan: "plus",
        provider: "google" as const,
        referenceId: user.id,
        status: "active",
      };

      await expect(
        prisma.subscription.create({
          data: { ...row, providerSubscriptionId: makePurchaseToken() },
        }),
      ).rejects.toThrow();

      await expect(
        prisma.subscription.create({ data: { ...row, userId: user.id } }),
      ).rejects.toThrow();
    });
  });
});
