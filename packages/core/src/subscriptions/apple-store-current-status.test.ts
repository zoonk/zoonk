import { randomUUID } from "node:crypto";
import {
  AutoRenewStatus,
  Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  NotificationTypeV2,
  type SignedDataVerifier,
  Status,
  Type,
} from "@apple/app-store-server-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppleSubscriptionFromNotification,
  getAppleSubscriptionFromTransaction,
} from "./apple-store";
import type * as AppleStoreConfig from "./apple-store-config";

const storeMocks = vi.hoisted(() => ({
  getAppStoreServerClient: vi.fn(),
  getSignedDataVerifier: vi.fn(),
}));

vi.mock("./apple-store-config", async (importOriginal) => {
  const original = await importOriginal<typeof AppleStoreConfig>();

  return {
    ...original,
    getAppStoreServerClient: storeMocks.getAppStoreServerClient,
    getSignedDataVerifier: storeMocks.getSignedDataVerifier,
  };
});

const OUTER_SIGNED_DATE = new Date("2026-08-19T12:00:00.000Z");
const CURRENT_EXPIRATION_DATE = new Date("2026-09-19T12:00:00.000Z");

describe(getAppleSubscriptionFromNotification, () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prefers the current App Store status while retaining notification ordering", async () => {
    const accountToken = randomUUID();
    const notificationUUID = randomUUID();
    const originalTransactionId = randomUUID();

    const notificationTransaction = makeTransaction({
      accountToken,
      expirationDate: new Date("2026-08-18T12:00:00.000Z"),
      originalTransactionId,
      productId: "com.zoonk.plus.monthly",
      signedDate: new Date("2026-08-18T12:00:00.000Z"),
      transactionId: "notification-transaction",
    });

    const notificationRenewalInfo = makeRenewalInfo({
      accountToken,
      originalTransactionId,
      productId: "com.zoonk.plus.monthly",
      renewalDate: new Date("2026-08-18T12:00:00.000Z"),
      signedDate: new Date("2026-08-18T12:00:00.000Z"),
    });

    const currentTransaction = makeTransaction({
      accountToken,
      expirationDate: CURRENT_EXPIRATION_DATE,
      originalTransactionId,
      productId: "com.zoonk.plus.yearly",
      signedDate: new Date("2026-08-19T11:59:00.000Z"),
      transactionId: "current-transaction",
    });

    const currentRenewalInfo = makeRenewalInfo({
      accountToken,
      originalTransactionId,
      productId: "com.zoonk.plus.yearly",
      renewalDate: CURRENT_EXPIRATION_DATE,
      signedDate: new Date("2026-08-19T11:59:30.000Z"),
    });

    const verifier = {
      verifyAndDecodeNotification: vi
        .fn()
        .mockResolvedValue({
          data: {
            signedRenewalInfo: "notification-renewal",
            signedTransactionInfo: "notification-transaction",
            status: Status.ACTIVE,
          },
          notificationType: NotificationTypeV2.DID_RENEW,
          notificationUUID,
          signedDate: OUTER_SIGNED_DATE.getTime(),
        }),
      verifyAndDecodeRenewalInfo: vi
        .fn()
        .mockImplementation((signedRenewalInfo: string) =>
          Promise.resolve(
            signedRenewalInfo === "current-renewal" ? currentRenewalInfo : notificationRenewalInfo,
          ),
        ),
      verifyAndDecodeTransaction: vi
        .fn()
        .mockImplementation((signedTransaction: string) =>
          Promise.resolve(
            signedTransaction === "current-transaction"
              ? currentTransaction
              : notificationTransaction,
          ),
        ),
    } as unknown as SignedDataVerifier;

    const getAllSubscriptionStatuses = vi
      .fn()
      .mockResolvedValue({
        data: [
          {
            lastTransactions: [
              {
                originalTransactionId,
                signedRenewalInfo: "current-renewal",
                signedTransactionInfo: "current-transaction",
                status: Status.ACTIVE,
              },
            ],
          },
        ],
      });

    storeMocks.getSignedDataVerifier.mockReturnValue({
      environment: Environment.SANDBOX,
      verifier,
    });

    storeMocks.getAppStoreServerClient.mockReturnValue({ getAllSubscriptionStatuses });

    await expect(
      getAppleSubscriptionFromNotification({ signedPayload: "signed-notification" }),
    ).resolves.toMatchObject({
      eventId: notificationUUID,
      eventSignedDate: OUTER_SIGNED_DATE,
      expirationDate: CURRENT_EXPIRATION_DATE,
      isActive: true,
      productId: "com.zoonk.plus.yearly",
      transactionId: "current-transaction",
    });

    expect(getAllSubscriptionStatuses).toHaveBeenCalledExactlyOnceWith("notification-transaction");
  });
});

describe(getAppleSubscriptionFromTransaction, () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a production transaction snapshot when the current subscription chain is unavailable", async () => {
    const accountToken = randomUUID();
    const originalTransactionId = randomUUID();

    const transaction = makeTransaction({
      accountToken,
      expirationDate: new Date("2026-08-18T12:00:00.000Z"),
      originalTransactionId,
      productId: "com.zoonk.plus.monthly",
      revocationDate: OUTER_SIGNED_DATE,
      signedDate: OUTER_SIGNED_DATE,
      transactionId: "refunded-old-transaction",
    });

    const verifier = {
      verifyAndDecodeTransaction: vi.fn().mockResolvedValue(transaction),
    } as unknown as SignedDataVerifier;

    storeMocks.getSignedDataVerifier.mockReturnValue({
      environment: Environment.SANDBOX,
      verifier,
    });

    storeMocks.getAppStoreServerClient.mockReturnValue(null);

    await expect(
      getAppleSubscriptionFromTransaction({ signedTransaction: "refunded-old-transaction" }),
    ).rejects.toMatchObject({ reason: "unavailable" });
  });
});

function makeTransaction({
  accountToken,
  expirationDate,
  originalTransactionId,
  productId,
  revocationDate,
  signedDate,
  transactionId,
}: {
  accountToken: string;
  expirationDate: Date;
  originalTransactionId: string;
  productId: string;
  revocationDate?: Date;
  signedDate: Date;
  transactionId: string;
}): JWSTransactionDecodedPayload {
  return {
    appAccountToken: accountToken,
    bundleId: "com.zoonk",
    environment: Environment.SANDBOX,
    expiresDate: expirationDate.getTime(),
    originalTransactionId,
    productId,
    purchaseDate: new Date("2026-08-01T12:00:00.000Z").getTime(),
    revocationDate: revocationDate?.getTime(),
    signedDate: signedDate.getTime(),
    transactionId,
    type: Type.AUTO_RENEWABLE_SUBSCRIPTION,
  };
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
}): JWSRenewalInfoDecodedPayload {
  return {
    appAccountToken: accountToken,
    autoRenewStatus: AutoRenewStatus.ON,
    environment: Environment.SANDBOX,
    originalTransactionId,
    productId,
    renewalDate: renewalDate.getTime(),
    signedDate: signedDate.getTime(),
  };
}
