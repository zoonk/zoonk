import { randomUUID } from "node:crypto";
import {
  AutoRenewStatus,
  Environment,
  NotificationTypeV2,
  Status,
  Type,
} from "@apple/app-store-server-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppleSubscriptionFromNotification,
  getAppleSubscriptionFromTransaction,
} from "./apple-store";
import { getAppStoreServerClient } from "./apple-store-config";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeUnsignedXcodePayload(payload: unknown) {
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}

function makeUnsignedXcodeTransaction({
  bundleId = "com.zoonk.dev",
  environment = "Xcode",
}: {
  bundleId?: string;
  environment?: string;
}) {
  const now = Date.now();

  const payload = {
    appAccountToken: randomUUID(),
    bundleId,
    environment,
    expiresDate: now + 86_400_000,
    originalTransactionId: "2000000123456789",
    productId: "com.zoonk.plus.monthly",
    purchaseDate: now,
    signedDate: now,
    transactionId: "2000000123456790",
    type: "Auto-Renewable Subscription",
  };

  return makeUnsignedXcodePayload(payload);
}

function allowXcodeTransactions() {
  vi.stubEnv("APPLE_IAP_ALLOW_XCODE_TRANSACTIONS", "true");
  vi.stubEnv("APPLE_IAP_ISSUER_ID", "");
  vi.stubEnv("APPLE_IAP_KEY_ID", "");
  vi.stubEnv("APPLE_IAP_PRIVATE_KEY", "");
}

describe(getAppStoreServerClient, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires App Store Server API credentials outside local Xcode transactions", () => {
    vi.stubEnv("APPLE_IAP_ISSUER_ID", "");
    vi.stubEnv("APPLE_IAP_KEY_ID", "");
    vi.stubEnv("APPLE_IAP_PRIVATE_KEY", "");

    expect(() => getAppStoreServerClient(Environment.SANDBOX)).toThrow(
      expect.objectContaining({ reason: "configuration" }),
    );
  });
});

describe(getAppleSubscriptionFromTransaction, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("provides an explicit non-production boundary for Xcode StoreKit transactions", async () => {
    allowXcodeTransactions();

    await expect(
      getAppleSubscriptionFromTransaction({ signedTransaction: makeUnsignedXcodeTransaction({}) }),
    ).resolves.toMatchObject({ environment: "xcode", isActive: true });
  });

  it("never enables the unsigned Xcode boundary in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TESTING", "false");
    vi.stubEnv("APPLE_IAP_ALLOW_XCODE_TRANSACTIONS", "true");

    await expect(
      getAppleSubscriptionFromTransaction({ signedTransaction: makeUnsignedXcodeTransaction({}) }),
    ).rejects.toMatchObject({ reason: "invalidTransaction" });
  });

  it("still requires the allowlisted bundle identifier for Xcode transactions", async () => {
    vi.stubEnv("APPLE_IAP_ALLOW_XCODE_TRANSACTIONS", "true");

    await expect(
      getAppleSubscriptionFromTransaction({
        signedTransaction: makeUnsignedXcodeTransaction({ bundleId: "com.example.other" }),
      }),
    ).rejects.toMatchObject({ reason: "invalidTransaction" });
  });
});

describe(getAppleSubscriptionFromNotification, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([NotificationTypeV2.CONSUMPTION_REQUEST, NotificationTypeV2.REFUND_DECLINED])(
    "acknowledges %s without treating its transaction as an entitlement change",
    async (notificationType) => {
      allowXcodeTransactions();

      const signedPayload = makeUnsignedXcodePayload({
        data: {
          bundleId: "com.zoonk.dev",
          environment: "Xcode",
          signedTransactionInfo: "not-an-entitlement-snapshot",
        },
        notificationType,
        notificationUUID: randomUUID(),
        signedDate: Date.now(),
        version: "2.0",
      });

      await expect(getAppleSubscriptionFromNotification({ signedPayload })).resolves.toBeNull();
    },
  );

  it.each([NotificationTypeV2.REFUND, NotificationTypeV2.REFUND_REVERSED])(
    "keeps an active current renewal when %s carries an older transaction",
    async (notificationType) => {
      allowXcodeTransactions();

      const now = Date.now();
      const accountToken = randomUUID();
      const originalTransactionId = randomUUID();
      const currentRenewalDate = now + 86_400_000;

      const signedTransactionInfo = makeUnsignedXcodePayload({
        appAccountToken: accountToken,
        bundleId: "com.zoonk.dev",
        environment: "Xcode",
        expiresDate: now - 86_400_000,
        originalTransactionId,
        productId: "com.zoonk.plus.monthly",
        purchaseDate: now - 2 * 86_400_000,
        ...(notificationType === NotificationTypeV2.REFUND && { revocationDate: now }),
        signedDate: now,
        transactionId: randomUUID(),
        type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
      });

      const signedRenewalInfo = makeUnsignedXcodePayload({
        appAccountToken: accountToken,
        autoRenewStatus: AutoRenewStatus.ON,
        environment: "Xcode",
        originalTransactionId,
        productId: "com.zoonk.plus.yearly",
        renewalDate: currentRenewalDate,
        signedDate: now,
      });

      const signedPayload = makeUnsignedXcodePayload({
        data: {
          bundleId: "com.zoonk.dev",
          environment: "Xcode",
          signedRenewalInfo,
          signedTransactionInfo,
          status: Status.ACTIVE,
        },
        notificationType,
        notificationUUID: randomUUID(),
        signedDate: now + 1,
        version: "2.0",
      });

      await expect(getAppleSubscriptionFromNotification({ signedPayload })).resolves.toMatchObject({
        expirationDate: new Date(currentRenewalDate),
        isActive: true,
        productId: "com.zoonk.plus.yearly",
        revocationDate: null,
      });
    },
  );
});
