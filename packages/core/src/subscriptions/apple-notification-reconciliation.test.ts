import { randomUUID } from "node:crypto";
import { AutoRenewStatus, NotificationTypeV2, Status, Type } from "@apple/app-store-server-library";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { processAppleSubscriptionNotification } from "./process-apple-subscription-notification";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function makeUnsignedXcodePayload(payload: unknown) {
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}

function makeTransaction({
  accountToken,
  expirationDate,
  originalTransactionId,
  productId,
  purchaseDate,
  revocationDate,
  signedDate,
}: {
  accountToken: string;
  expirationDate: Date;
  originalTransactionId: string;
  productId: string;
  purchaseDate: Date;
  revocationDate?: Date;
  signedDate: Date;
}) {
  return makeUnsignedXcodePayload({
    appAccountToken: accountToken,
    bundleId: "com.zoonk.dev",
    environment: "Xcode",
    expiresDate: expirationDate.getTime(),
    originalTransactionId,
    productId,
    purchaseDate: purchaseDate.getTime(),
    ...(revocationDate && { revocationDate: revocationDate.getTime() }),
    signedDate: signedDate.getTime(),
    transactionId: randomUUID(),
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
  });
}

function makeRenewalInfo({
  accountToken,
  originalTransactionId,
  productId,
  renewalDate,
  signedDate,
}: {
  accountToken: string;
  originalTransactionId: string;
  productId: string;
  renewalDate: Date;
  signedDate: Date;
}) {
  return makeUnsignedXcodePayload({
    appAccountToken: accountToken,
    autoRenewStatus: AutoRenewStatus.ON,
    environment: "Xcode",
    originalTransactionId,
    productId,
    renewalDate: renewalDate.getTime(),
    signedDate: signedDate.getTime(),
  });
}

function makeNotification({
  notificationType,
  signedDate,
  signedRenewalInfo,
  signedTransactionInfo,
}: {
  notificationType: NotificationTypeV2;
  signedDate: Date;
  signedRenewalInfo: string;
  signedTransactionInfo: string;
}) {
  return makeUnsignedXcodePayload({
    data: {
      bundleId: "com.zoonk.dev",
      environment: "Xcode",
      signedRenewalInfo,
      signedTransactionInfo,
      status: Status.ACTIVE,
    },
    notificationType,
    notificationUUID: randomUUID(),
    signedDate: signedDate.getTime(),
    version: "2.0",
  });
}

describe(processAppleSubscriptionNotification, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("preserves the current entitlement and period end when a refund references an older renewal", async () => {
    vi.stubEnv("APPLE_IAP_ALLOW_XCODE_TRANSACTIONS", "true");
    vi.stubEnv("APPLE_IAP_ISSUER_ID", "");
    vi.stubEnv("APPLE_IAP_KEY_ID", "");
    vi.stubEnv("APPLE_IAP_PRIVATE_KEY", "");

    const user = await userFixture();
    const originalTransactionId = randomUUID();
    const currentPurchaseDate = new Date(Date.now() - 86_400_000);
    const currentExpirationDate = new Date(Date.now() + 365 * 86_400_000);
    const initialSignedDate = new Date();

    const currentRenewalInfo = makeRenewalInfo({
      accountToken: user.id,
      originalTransactionId,
      productId: "com.zoonk.plus.yearly",
      renewalDate: currentExpirationDate,
      signedDate: initialSignedDate,
    });

    const initialSubscription = await processAppleSubscriptionNotification({
      signedPayload: makeNotification({
        notificationType: NotificationTypeV2.DID_RENEW,
        signedDate: initialSignedDate,
        signedRenewalInfo: currentRenewalInfo,
        signedTransactionInfo: makeTransaction({
          accountToken: user.id,
          expirationDate: currentExpirationDate,
          originalTransactionId,
          productId: "com.zoonk.plus.yearly",
          purchaseDate: currentPurchaseDate,
          signedDate: initialSignedDate,
        }),
      }),
    });

    expect(initialSubscription).toMatchObject({
      billingInterval: "year",
      periodEnd: currentExpirationDate,
      status: "active",
    });

    const refundSignedDate = new Date(initialSignedDate.getTime() + 1000);

    const subscriptionAfterRefund = await processAppleSubscriptionNotification({
      signedPayload: makeNotification({
        notificationType: NotificationTypeV2.REFUND,
        signedDate: refundSignedDate,
        signedRenewalInfo: makeRenewalInfo({
          accountToken: user.id,
          originalTransactionId,
          productId: "com.zoonk.plus.yearly",
          renewalDate: currentExpirationDate,
          signedDate: refundSignedDate,
        }),
        signedTransactionInfo: makeTransaction({
          accountToken: user.id,
          expirationDate: new Date(currentPurchaseDate.getTime() - 1),
          originalTransactionId,
          productId: "com.zoonk.plus.monthly",
          purchaseDate: new Date(currentPurchaseDate.getTime() - 31 * 86_400_000),
          revocationDate: refundSignedDate,
          signedDate: refundSignedDate,
        }),
      }),
    });

    expect(subscriptionAfterRefund).toMatchObject({
      billingInterval: "year",
      endedAt: null,
      periodEnd: currentExpirationDate,
      providerProductId: "com.zoonk.plus.yearly",
      status: "active",
    });
  });
});
